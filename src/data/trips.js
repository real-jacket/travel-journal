export const trips = [
  {
    id: "anhui",
    title: "皖南秋日摄影自驾",
    subtitle: "沿着山路，把秋天慢慢拍。",
    region: "安徽 · 皖南",
    status: "planned",
    statusLabel: "计划中",
    date: "2026.11.19 — 11.22",
    dateNote: "四天候选窗口",
    duration: "4天3晚",
    transport: "武汉出发 · 电车自驾",
    route: ["武汉", "泾县", "月亮湾", "桃岭", "方塘", "储家滩", "宁国", "武汉"],
    description: "白天走桃岭，清晨守方塘的一排红杉。在湖边住一晚，把晨雾、吃饭和休息一起排进路书。",
    tags: ["红杉倒影", "盘山公路", "晨雾", "电车补能"],
    path: "trips/anhui/",
    image: "images/anhui-fangtang.webp",
    imageAlt: "方塘的一排红杉立在静水与薄雾中，湖岸与倒影构成画面。",
    imageCredit: "9527是只猫 · 方塘摄影参考",
    imageSource: "https://www.xiaohongshu.com/explore/692afba9000000001e028e2a",
    highlights: "路线地图 · 逐日行程 · 经典机位 · 吃住与补能",
  },
  {
    id: "khingan",
    title: "大兴安岭南线追秋",
    subtitle: "把金色森林，留在九天的路上。",
    region: "内蒙古 · 阿尔山与呼伦贝尔",
    status: "archived",
    statusLabel: "历史路书",
    date: "2026.09.25 — 10.03",
    dateNote: "已归档的行程计划",
    duration: "9天8晚",
    transport: "武汉往返 · 落地租车",
    route: ["乌兰浩特", "阿尔山", "蘑阿公路", "柴河", "牙克石", "莫尔格勒河", "海拉尔"],
    description: "乌兰浩特进、海拉尔出。沿蘑阿公路穿过森林，在柴河与阿尔山慢慢停留，收集河谷、湖泊和秋色。",
    tags: ["金色森林", "河谷晨雾", "蘑阿公路", "落地自驾"],
    path: "trips/khingan/",
    image: "images/khingan-haraha.webp",
    imageAlt: "阿尔山哈拉哈河秋日实景，金色枝叶、河谷与桥梁在晨雾中相遇。",
    imageCredit: "哈拉哈河 · 原路书摄影笔记",
    imageSource: "https://www.xiaohongshu.com/explore/6a979c380000000026021067",
    highlights: "南线路线 · 每日拍摄 · 住宿基地 · 行前清单",
  },
];

export function getFeaturedTrip(items) {
  return items.find((trip) => trip.status === "planned") || items[0];
}

export function renderTripLinks(items) {
  const escape = (text) => text.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  return items.map((trip) => `<a href="./${escape(trip.path)}">${escape(trip.title)}</a>`).join(" · ");
}

export function filterTrips(items, query = "", status = "all") {
  const terms = query.normalize("NFKC").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((trip) => {
    if (status !== "all" && trip.status !== status) return false;
    const text = [trip.title, trip.subtitle, trip.region, trip.description, trip.date, trip.transport, ...trip.route, ...trip.tags]
      .join(" ").normalize("NFKC").toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
