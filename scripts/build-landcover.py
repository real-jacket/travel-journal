#!/usr/bin/env python3
"""Authoring-time land-cover raster: ESA WorldCover 2021 v200 (10 m, CC-BY 4.0) -> generalised, coloured 512 px Web Mercator tiles in an MBTiles file.
usage (normally run by `pnpm map:build <slug> --landcover`):
  uv run --with rasterio --with numpy --with scipy --with pillow scripts/build-landcover.py <config.json> <out.mbtiles> <cache-dir>
  ... --selftest
config.landcover: { format?: "png"|"webp", speckHa?: 0.5, tiers: [{ bbox:[w,s,e,n], minzoom, maxzoom, master? }] }
  master (default maxzoom) is the zoom the source is resampled to before generalising; a wide low-zoom tier uses a finer master than its maxzoom to stay cheap.
Pipeline per tier: reproject (mode) -> 3x3 majority -> drop specks < speckHa (half for built-up/water) -> 2x2 mode downsample for each lower zoom (never colour averaging) -> palette PNG.
Source tiles (3 deg, named by SW corner, ~136 MB each) are cached in <cache-dir> (work/cache/worldcover, git-ignored).
"""
import io, json, math, os, sqlite3, sys, urllib.request
import numpy as np
from scipy import ndimage
from PIL import Image

ORIGIN = 20037508.342789244
URL = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{}_Map.tif'
# palette index -> colour; WorldCover codes map to the index (95 mangrove joins 90 wetland)
PALETTE = [None, '#b5c79e', '#cbd5ac', '#dde2b6', '#efe2b2', '#d9bfae', '#e5dac6', '#f4f2ec', '#b7cdcf', '#c3d7c9', '#d8dcc4']
CODES = {10: 1, 20: 2, 30: 3, 40: 4, 50: 5, 60: 6, 70: 7, 80: 8, 90: 9, 95: 9, 100: 10}
TIE_ORDER = [8, 5, 9, 4, 3, 2, 6, 7, 10, 1]  # on a 2-2 tie keep the rarer, more legible class (water, built-up ...)
SMALL_HALF = {5, 8}  # villages and ponds keep half the speck area
LOW_SPECK_PX = 6     # speck size (pixels) removed again at every lower zoom: ground area grows 4x per level


def tile_px(lon, lat, z):
    n = 512 * 2 ** z
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n


def vote(a, valid, size, need=None, rows=1024):
    """Majority class in a size x size window over `valid` pixels (ties keep the centre). Returns 0 where no valid neighbour."""
    h = a.shape[0]
    out = np.zeros_like(a)
    present = [c for c in np.nonzero(np.bincount(a[valid].ravel(), minlength=len(PALETTE)))[0] if c]
    r = size // 2
    for y0 in range(0, h, rows):
        y1 = min(h, y0 + rows)
        if need is not None and not need[y0:y1].any():
            continue
        ya, yb = max(0, y0 - r), min(h, y1 + r)
        blk, v = a[ya:yb], valid[ya:yb]
        best = np.zeros(blk.shape, np.float32)
        cls = np.zeros(blk.shape, np.uint8)
        for c in present:
            m = (blk == c) & v
            f = ndimage.uniform_filter(m.astype(np.float32), size, mode='constant') * (size * size) + 0.5 * m
            sel = f > best + 1e-3
            best[sel], cls[sel] = f[sel], c
        out[y0:y1] = cls[y0 - ya:y0 - ya + (y1 - y0)]
    return out


def despeck(a, thr):
    """Replace connected same-class areas smaller than thr[class] pixels by the surrounding majority."""
    todo = np.zeros(a.shape, bool)
    for c in np.nonzero(np.bincount(a.ravel(), minlength=len(PALETTE)))[0]:
        if c == 0:
            continue
        lab, _ = ndimage.label(a == c)
        small = np.bincount(lab.ravel()) < (max(2, thr // 2) if c in SMALL_HALF else thr)
        small[0] = False
        todo |= small[lab]
    if not todo.any():
        return a
    out = a.copy()
    out[todo] = 0
    for _ in range(8):  # grow the surrounding majority inwards until the speck is gone
        fill = vote(out, out > 0, 5, need=todo)
        hit = todo & (fill > 0)
        out[hit] = fill[hit]
        todo &= ~hit
        if not todo.any():
            break
    out[todo] = a[todo]
    return out


def mode2(a):
    """2x2 mode downsample; nodata (0) only wins when all four are nodata."""
    q = [a[0::2, 0::2], a[0::2, 1::2], a[1::2, 0::2], a[1::2, 1::2]]
    best = np.zeros(q[0].shape, np.uint8)
    cls = np.zeros(q[0].shape, np.uint8)
    for c in [c for c in TIE_ORDER if (a == c).any()]:
        n = sum((p == c).astype(np.uint8) for p in q)
        sel = n > best
        best[sel], cls[sel] = n[sel], c
    return cls


def halve(a, tx0, ty0):
    """a covers whole 512 px tiles starting at (tx0, ty0); pad to even tile bounds, downsample, return the array one zoom up."""
    nx, ny = a.shape[1] // 512, a.shape[0] // 512
    pad = ((512 * (ty0 % 2), 512 * ((ty0 + ny - 1) % 2 == 0)), (512 * (tx0 % 2), 512 * ((tx0 + nx - 1) % 2 == 0)))
    a = np.pad(a, pad)
    out = mode2(a)
    assert out.shape[0] % 512 == 0 and out.shape[1] % 512 == 0
    return out, tx0 // 2, ty0 // 2


def source_names(bbox):
    w, s, e, n = bbox
    return [f'{"N" if lat >= 0 else "S"}{abs(lat):02d}{"E" if lon >= 0 else "W"}{abs(lon):03d}'
            for lat in range(math.floor(s / 3) * 3, math.ceil(n / 3) * 3, 3) for lon in range(math.floor(w / 3) * 3, math.ceil(e / 3) * 3, 3)]


def fetch(name, cache):
    path = os.path.join(cache, f'ESA_WorldCover_10m_2021_v200_{name}_Map.tif')
    if not os.path.exists(path):
        os.makedirs(cache, exist_ok=True)
        print(f'downloading {name} (~136 MB)', flush=True)
        part, url = path + '.part', URL.format(name)
        want = int(urllib.request.urlopen(urllib.request.Request(url, method='HEAD')).headers['Content-Length'])
        for _ in range(30):  # a proxy can cut the stream silently: resume with Range until the size matches
            have = os.path.getsize(part) if os.path.exists(part) else 0
            if have >= want:
                break
            req = urllib.request.Request(url, headers={'Range': f'bytes={have}-'})
            try:
                with urllib.request.urlopen(req) as r, open(part, 'ab' if r.status == 206 else 'wb') as f:
                    while chunk := r.read(1 << 20):
                        f.write(chunk)
            except OSError as e:
                print(f'  {name}: {e}; resuming', flush=True)
        if os.path.getsize(part) != want:
            raise IOError(f'{name}: got {os.path.getsize(part)} of {want} bytes')
        os.rename(part, path)
    return path


def build_master(tier, master, cache):
    import rasterio
    from rasterio.warp import reproject, Resampling
    from rasterio.transform import Affine
    w, s, e, n = tier['bbox']
    x0, y1 = tile_px(w, n, master)
    x1, y0 = tile_px(e, s, master)
    tx0, tx1, ty0, ty1 = int(x0 // 512), int(x1 // 512), int(y1 // 512), int(y0 // 512)
    res = 2 * ORIGIN / (512 * 2 ** master)
    dst = np.zeros(((ty1 - ty0 + 1) * 512, (tx1 - tx0 + 1) * 512), np.uint8)
    tr = Affine(res, 0, -ORIGIN + tx0 * 512 * res, 0, -res, ORIGIN - ty0 * 512 * res)
    for name in source_names(tier['bbox']):
        with rasterio.open(fetch(name, cache)) as ds:
            reproject(rasterio.band(ds, 1), dst, dst_transform=tr, dst_crs='EPSG:3857', resampling=Resampling.mode,
                      src_nodata=0, dst_nodata=0, init_dest_nodata=False, num_threads=4)
    lut = np.zeros(256, np.uint8)
    for code, idx in CODES.items():
        lut[code] = idx
    return lut[dst], tx0, ty0, res


def encode(tile, fmt):
    pal = [0] * 3
    for hexc in PALETTE[1:]:
        pal += [int(hexc[i:i + 2], 16) for i in (1, 3, 5)]
    im = Image.fromarray(tile, 'P')
    im.putpalette(pal)
    im.info['transparency'] = 0  # nodata must stay transparent through convert('RGBA'), or it renders black
    buf = io.BytesIO()
    if fmt == 'webp':
        im.convert('RGBA').save(buf, 'WEBP', lossless=True, quality=100, method=4)
    else:
        im.save(buf, 'PNG', optimize=True, transparency=0)
    return buf.getvalue()


def run(cfg, out, cache):
    lc = cfg['landcover']
    fmt = lc.get('format', 'png')
    if os.path.exists(out):
        os.remove(out)
    db = sqlite3.connect(out)
    db.executescript('create table metadata (name text, value text); create table tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob);'
                     'create unique index tile_index on tiles (zoom_level, tile_column, tile_row);')
    tiers = lc['tiers']
    zooms = [t['minzoom'] for t in tiers] + [t['maxzoom'] for t in tiers]
    for tier in tiers:
        master = tier.get('master', tier['maxzoom'])
        a, tx0, ty0, res = build_master(tier, master, cache)
        lat = (tier['bbox'][1] + tier['bbox'][3]) / 2
        thr = max(3, round(lc.get('speckHa', 0.5) * 1e4 / (res * math.cos(math.radians(lat))) ** 2))
        nodata = a == 0
        a = vote(a, a > 0, 3)
        a[nodata] = 0
        a = despeck(a, thr)
        z = master
        print(f'tier {tier["bbox"]} master z{master} {a.shape[1]}x{a.shape[0]} px, speck {thr} px', flush=True)
        while True:
            if tier['minzoom'] <= z <= tier['maxzoom']:
                count = size = 0
                for ty in range(a.shape[0] // 512):
                    for tx in range(a.shape[1] // 512):
                        t = a[ty * 512:(ty + 1) * 512, tx * 512:(tx + 1) * 512]
                        if not t.any():
                            continue
                        data = encode(t, fmt)
                        db.execute('insert into tiles values (?,?,?,?)', (z, tx0 + tx, 2 ** z - 1 - (ty0 + ty), data))
                        count, size = count + 1, size + len(data)
                print(f'  z{z}: {count} tiles, {size / 1e6:.2f} MB', flush=True)
            if z <= tier['minzoom']:
                break
            a, tx0, ty0 = halve(a, tx0, ty0)
            z -= 1
            a = despeck(a, LOW_SPECK_PX)
        db.commit()
    ws, ss, es, ns = [min(t['bbox'][0] for t in tiers), min(t['bbox'][1] for t in tiers), max(t['bbox'][2] for t in tiers), max(t['bbox'][3] for t in tiers)]
    meta = {'name': 'landcover', 'format': 'webp' if fmt == 'webp' else 'png', 'type': 'overlay', 'version': '1', 'minzoom': min(zooms), 'maxzoom': max(zooms),
            'bounds': f'{ws},{ss},{es},{ns}', 'attribution': 'ESA WorldCover 2021 v200 (CC BY 4.0)'}
    db.executemany('insert into metadata values (?,?)', [(k, str(v)) for k, v in meta.items()])
    db.commit()
    db.close()


def selftest():
    a = np.ones((1024, 1024), np.uint8)
    a[100:102, 100:102] = 4  # 4 px speck inside forest
    a[600:700, 600:700] = 4  # real field
    assert (despeck(a, 10)[100:102, 100:102] == 1).all() and (despeck(a, 10)[650, 650] == 4)
    p = np.zeros((4, 4), np.uint8)
    p[:2, :2] = [[1, 1], [1, 8]]
    assert mode2(p)[0, 0] == 1 and mode2(p)[1, 1] == 0
    b, tx0, ty0 = halve(np.ones((512, 1024), np.uint8), 3, 5)
    assert (tx0, ty0, b.shape) == (1, 2, (512, 1024)) and b[0, 0] == 0 and b[300, 300] == 1  # odd origin pads a nodata tile
    t = np.zeros((512, 512), np.uint8); t[:, 256:] = 1
    px = Image.open(io.BytesIO(encode(t, 'webp'))).convert('RGBA')
    assert px.getpixel((0, 0))[3] == 0 and px.getpixel((300, 0))[3] == 255  # nodata stays transparent
    print('selftest ok')


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        selftest()
    else:
        run(json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3])
