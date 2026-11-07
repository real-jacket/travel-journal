import { useState } from "react";
import { ArrowDown, ArrowUpRight, BookOpen, CalendarDays, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { trips, filterTrips } from "./data/trips.js";

const asset = (path) => `${import.meta.env.BASE_URL}${path}`;
const currentTrip = trips[0];

function TripCard({ trip, index }) {
  return (
    <article aria-labelledby={`trip-title-${trip.id}`}>
      <Card className="trip-card h-full">
        <a className={`trip-image trip-image-${trip.id}`} href={asset(trip.path)} aria-label={`查看${trip.title}完整路书`}>
          <img src={asset(trip.image)} alt={trip.imageAlt} width="900" height="600" loading="lazy" decoding="async" />
          <span className="image-name">{trip.region}</span>
        </a>
        <CardHeader>
          <div className="trip-card-topline">
            <span className="trip-number">{String(index + 1).padStart(2, "0")} / 2026</span>
            <Badge variant={trip.status === "planned" ? "secondary" : "outline"}>{trip.statusLabel}</Badge>
          </div>
          <CardTitle>
            <h3 id={`trip-title-${trip.id}`}><a href={asset(trip.path)}>{trip.title}</a></h3>
          </CardTitle>
          <CardDescription>{trip.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="trip-meta">
            <p><CalendarDays aria-hidden="true" /><span>{trip.date}<small>{trip.dateNote}</small></span></p>
            <p><MapPin aria-hidden="true" /><span>{trip.duration}<small>{trip.transport}</small></span></p>
          </div>
          <p className="trip-description">{trip.description}</p>
          <p className="trip-route">{trip.route.join(" → ")}</p>
          <div className="trip-tags" aria-label="旅行题材">
            {trip.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
          </div>
        </CardContent>
        <CardFooter className="mt-auto flex-col items-stretch gap-4">
          <div className="trip-footer">
            <p>{trip.highlights}</p>
            <Button asChild variant="outline">
              <a href={asset(trip.path)} aria-label={`打开${trip.title}完整路书`}>打开路书<ArrowUpRight data-icon="inline-end" /></a>
            </Button>
          </div>
          <a className="photo-credit" href={trip.imageSource} target="_blank" rel="noopener noreferrer">{trip.imageCredit}<ArrowUpRight aria-hidden="true" /></a>
        </CardFooter>
      </Card>
    </article>
  );
}

export function App() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const visibleTrips = filterTrips(trips, query, status);
  const reset = () => { setQuery(""); setStatus("all"); };

  return (
    <>
      <a className="skip-link" href="#main">跳到旅行项目</a>
      <header className="site-header" id="top">
        <div className="page-width header-inner">
          <a className="brand" href={import.meta.env.BASE_URL} aria-label="山野取景首页">
            <strong>山野取景</strong><span>TRAVEL<br />FIELD NOTES</span>
          </a>
          <nav aria-label="首页导航"><a href="#projects">旅行项目</a><a href="#about">关于路书</a></nav>
          <Button asChild variant="outline"><a href={asset(currentTrip.path)}>这次去皖南<ArrowUpRight data-icon="inline-end" /></a></Button>
        </div>
      </header>
      <main id="main">
        <section className="page-width hero" aria-labelledby="hero-title">
          <div className="hero-masthead"><span>2026 / 旅行手记</span><span>从武汉出发，去有好光的地方。</span></div>
          <div className="hero-grid">
            <div className="hero-copy">
              <h1 id="hero-title">把每一次出发，<br />收进同一本<span>路书。</span></h1>
              <p>去山野，等一束光。<br />把路线、机位与沿途吃住整理好，<br />出发时从这里打开。</p>
              <div className="hero-actions">
                <Button asChild size="lg"><a href={asset(currentTrip.path)}>打开皖南四天路书<ArrowUpRight data-icon="inline-end" /></a></Button>
                <Button asChild variant="ghost" size="lg"><a href="#projects">查看所有旅行<ArrowDown data-icon="inline-end" /></a></Button>
              </div>
              <div className="hero-trip-note"><Badge variant="secondary">下一次出发</Badge><span>皖南 · 4天3晚 · 11月候选</span></div>
            </div>
            <figure className="hero-photo">
              <a href={asset(currentTrip.path)} aria-label="进入皖南秋日摄影自驾路书"><img src={asset(currentTrip.image)} alt={currentTrip.imageAlt} width="1200" height="680" fetchPriority="high" /></a>
              <figcaption><span>方塘 · 把清晨留给一排红杉</span><a href={currentTrip.imageSource} target="_blank" rel="noopener noreferrer">9527是只猫 / 原作<ArrowUpRight aria-hidden="true" /></a></figcaption>
            </figure>
          </div>
          <div className="intro-note"><p>皖南的湖山与古村，大兴安岭的森林与河谷。<br className="mobile-break" /> 两次出发，两份可以随身翻看的路书。</p><span>{String(trips.length).padStart(2, "0")} 份旅行项目</span></div>
        </section>

        <section className="page-width projects-section" id="projects" aria-labelledby="projects-title">
          <div className="section-heading"><div><p className="section-index">01 / 旅行项目</p><h2 id="projects-title">下一次出发，和之前的计划。</h2></div><p>打开一份路书，<br />就能找到完整的路线与拍摄安排。</p></div>
          <FieldGroup className="project-filters">
            <Field className="search-field">
              <FieldLabel htmlFor="trip-search" className="sr-only">搜索旅行项目</FieldLabel>
              <InputGroup>
                <InputGroupInput id="trip-search" type="search" placeholder="搜索目的地、路线或拍摄题材" value={query} onChange={(event) => setQuery(event.target.value)} />
                <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
                {query && <InputGroupAddon align="inline-end"><InputGroupButton size="icon-sm" aria-label="清除搜索" onClick={() => setQuery("")}><X aria-hidden="true" /></InputGroupButton></InputGroupAddon>}
              </InputGroup>
            </Field>
            <Field className="status-field">
              <FieldLabel id="trip-status-label" className="sr-only">旅行项目状态</FieldLabel>
              <ToggleGroup type="single" value={status} onValueChange={(value) => { if (value) setStatus(value); }} variant="outline" spacing={0} aria-labelledby="trip-status-label">
                <ToggleGroupItem value="all">全部路书</ToggleGroupItem>
                <ToggleGroupItem value="planned">计划中</ToggleGroupItem>
                <ToggleGroupItem value="archived">历史路书</ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </FieldGroup>
          <div className="filter-result" role="status" aria-live="polite"><span>{visibleTrips.length} 份路书</span>{(query || status !== "all") && <Button variant="link" onClick={reset}>重置筛选</Button>}</div>
          {visibleTrips.length ? <div className="trip-grid">{visibleTrips.map((trip) => <TripCard key={trip.id} trip={trip} index={trips.indexOf(trip)} />)}</div> : <Empty>
            <EmptyHeader><EmptyMedia variant="icon"><Search /></EmptyMedia><EmptyTitle>还没有找到这份路书</EmptyTitle><EmptyDescription>换一个目的地，或清除筛选，看看已有的旅行。</EmptyDescription></EmptyHeader>
            <EmptyContent><Button variant="outline" onClick={reset}>查看全部路书</Button></EmptyContent>
          </Empty>}
        </section>

        <section className="about-section" id="about" aria-labelledby="about-title">
          <div className="page-width about-grid">
            <div><p className="section-index">02 / 关于路书</p><h2 id="about-title">出发之前，<br />把值得停留的地方记下来。</h2></div>
            <div className="about-copy"><p>这是一本持续整理的摄影旅行路书。从想去的地方开始，把怎么走、什么时候拍、今晚住哪里放在一起。上路之后，少一点来回找攻略，多一点留在风景里的时间。</p><Separator /><div className="about-features"><p><BookOpen aria-hidden="true" /><span>完整攻略<small>行程、摄影、吃住与出行准备</small></span></p><p><MapPin aria-hidden="true" /><span>各自成册<small>从首页进入，也能随时回来</small></span></p></div><p className="about-caption">皖南日期是候选计划；历史路书保留当时的安排。图像为有出处的摄影参考，秋色与现场信息出发前再看一遍。</p></div>
          </div>
        </section>
      </main>
      <footer className="site-footer page-width"><a className="footer-brand" href="#top">山野取景</a><p>把好光、吃饭和休息，都放进路书。</p><a href="#projects">回到旅行项目<ArrowUpRight aria-hidden="true" /></a></footer>
    </>
  );
}
