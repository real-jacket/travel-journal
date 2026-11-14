import generated from "./trips.generated.json" with { type: "json" };

// Written by `pnpm trips:sync` from trips.json; git-ignored.
export const trips = generated;

export function getFeaturedTrip(items) {
  return items.find((trip) => trip.status === "planned") || items[0];
}

export function renderTripLinks(items) {
  const escape = (text) => text.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  return items.map((trip) => `<a href="${escape(trip.url)}">${escape(trip.title)}</a>`).join(" · ");
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
