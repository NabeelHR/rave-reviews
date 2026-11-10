import { db, schema, sqlClient } from "./client.js";

// Vancouver seed. Hand-crafted but sizeable enough that the read endpoints and the
// landing page feel like a real catalog. Wipe-and-reseed each run.

type ReviewDef = {
  user: string;
  music: number;
  crowd: number;
  production: number | null; // null = "N/A"
  venue: number;
  text?: string;
};

type EventDef = {
  name: string;
  venue: string; // venue name
  artists: string[]; // 1 = primary; 2+ = b2b
  offsetDays: number; // negative = past, positive = upcoming
  position: number;
  brand?: string;
  reviews?: ReviewDef[]; // only past events carry reviews
};

async function main() {
  console.log("wiping…");
  await db.delete(schema.setRatings);
  await db.delete(schema.reviews);
  await db.delete(schema.attendance);
  await db.delete(schema.setArtists);
  await db.delete(schema.sets);
  await db.delete(schema.events);
  await db.delete(schema.artistAliases);
  await db.delete(schema.artists);
  await db.delete(schema.venues);
  await db.delete(schema.brands);
  await db.delete(schema.users);

  console.log("seeding…");

  // Stable IDs: pinned so a user id stays valid across reseeds.
  const userRows = await db
    .insert(schema.users)
    .values([
      { id: "00000000-0000-4000-8000-000000000001", username: "alice", email: "alice@example.com" },
      { id: "00000000-0000-4000-8000-000000000002", username: "bob", email: "bob@example.com" },
      { id: "00000000-0000-4000-8000-000000000003", username: "chloe", email: "chloe@example.com" },
      { id: "00000000-0000-4000-8000-000000000004", username: "nabster", email: "nabster@example.com" },
      { id: "00000000-0000-4000-8000-000000000005", username: "dynamik", email: "dynamik@example.com" },
      { id: "00000000-0000-4000-8000-000000000006", username: "ravedaddy", email: "ravedaddy@example.com" },
      { id: "00000000-0000-4000-8000-000000000007", username: "ravebae", email: "ravebae@example.com" },
      { id: "00000000-0000-4000-8000-000000000008", username: "binibopper", email: "binibopper@example.com" },
    ])
    .returning();
  const U = Object.fromEntries(userRows.map((u) => [u.username, u.id]));

  const venueRows = await db
    .insert(schema.venues)
    .values([
      { name: "Celebrities", city: "Vancouver", region: "BC", country: "CA", capacity: 800 },
      { name: "Vancouver Convention Centre", city: "Vancouver", region: "BC", country: "CA", capacity: 5000 },
      { name: "Fortune Sound Club", city: "Vancouver", region: "BC", country: "CA", capacity: 400 },
      { name: "Open Studios", city: "Vancouver", region: "BC", country: "CA", capacity: 500 },
      { name: "Commodore Ballroom", city: "Vancouver", region: "BC", country: "CA", capacity: 990 },
      { name: "Harbour Event Centre", city: "Vancouver", region: "BC", country: "CA", capacity: 1200 },
      { name: "PNE Forum", city: "Vancouver", region: "BC", country: "CA", capacity: 2500 },
      { name: "The Pearl", city: "Vancouver", region: "BC", country: "CA", capacity: 650 },
    ])
    .returning();
  const V = Object.fromEntries(venueRows.map((v) => [v.name, v.id]));

  const [contact] = await db
    .insert(schema.brands)
    .values([{ name: "Contact Winter Music Festival" }])
    .returning();

  const artistNames = [
    "John Summit",
    "Chris Lake",
    "FISHER",
    "Dom Dolla",
    "Charlotte de Witte",
    "Fred again..",
    "Peggy Gou",
    "RÜFÜS DU SOL",
    "Bicep",
    "Sara Landry",
    "KETTAMA",
    "Four Tet",
    "Skrillex",
    "Overmono",
  ];
  const artistRows = await db
    .insert(schema.artists)
    .values(artistNames.map((name) => ({ name, canonicalName: name.toLowerCase() })))
    .returning();
  const A = Object.fromEntries(artistRows.map((a) => [a.name, a.id]));

  // ---------- Events (past carry reviews; upcoming don't) ----------
  const eventDefs: EventDef[] = [
    {
      name: "John Summit — Experts Only",
      venue: "Vancouver Convention Centre",
      artists: ["John Summit"],
      offsetDays: -30,
      position: 3,
      reviews: [
        { user: "alice", music: 9, crowd: 8, production: 10, venue: 7, text: "Cathedral of house. The rig held up and every drop hit like a freight train." },
        { user: "bob", music: 8, crowd: 7, production: 9, venue: 6, text: "Massive set, but the convention centre still feels like a conference hall." },
        { user: "nabster", music: 9, crowd: 9, production: 9, venue: 7, text: "Experts Only lived up to the name — two solid hours of peak-time euphoria." },
        { user: "ravedaddy", music: 7, crowd: 6, production: 8, venue: 6, text: "Sound was pristine, crowd was weirdly stiff toward the back." },
      ],
    },
    {
      name: "Chris Lake b2b FISHER",
      venue: "Celebrities",
      artists: ["Chris Lake", "FISHER"],
      offsetDays: -60,
      position: 2,
      brand: "Contact Winter Music Festival",
      reviews: [
        { user: "alice", music: 9, crowd: 10, production: null, venue: 8, text: "Sweat-dripping-off-the-ceiling night. No frills, all energy." },
        { user: "chloe", music: 8, crowd: 9, production: null, venue: 8, text: "Two legends trading tech-house bombs. Celebrities was absolutely heaving." },
        { user: "dynamik", music: 9, crowd: 9, production: 7, venue: 7, text: "FISHER's goofy energy plus Lake's groove = relentless. Lasers were basic though." },
        { user: "ravebae", music: 10, crowd: 10, production: 8, venue: 8, text: "Best b2b I've seen in this city. Did not stop moving once." },
      ],
    },
    {
      name: "Dom Dolla",
      venue: "Commodore Ballroom",
      artists: ["Dom Dolla"],
      offsetDays: -45,
      position: 2,
      reviews: [
        { user: "bob", music: 8, crowd: 8, production: 8, venue: 9, text: "The Commodore's sprung floor plus Dom Dolla's hooks is a perfect match." },
        { user: "chloe", music: 9, crowd: 8, production: 8, venue: 9, text: "San Frandisco three times and the whole room sang every word." },
        { user: "binibopper", music: 7, crowd: 7, production: 7, venue: 8, text: "Solid but a little safe — leaned hard on the radio singles." },
        { user: "ravedaddy", music: 8, crowd: 9, production: 8, venue: 9, text: "That bouncy dance floor is a national treasure. Great night out." },
      ],
    },
    {
      name: "Charlotte de Witte — KNTXT",
      venue: "Harbour Event Centre",
      artists: ["Charlotte de Witte"],
      offsetDays: -75,
      position: 3,
      reviews: [
        { user: "nabster", music: 10, crowd: 9, production: 9, venue: 8, text: "Relentless, hypnotic techno — she never once let the tension drop." },
        { user: "dynamik", music: 9, crowd: 8, production: 10, venue: 8, text: "Industrial-strength kick drums and fog so thick you couldn't see the booth." },
        { user: "ravebae", music: 9, crowd: 9, production: 9, venue: 7, text: "Dark, fast, immaculate. Harbour was exactly the right kind of cavernous." },
        { user: "alice", music: 8, crowd: 8, production: 9, venue: 7, text: "Punishing in the best way — completely lost track of time." },
      ],
    },
    {
      name: "Fred again.. — Actual Life",
      venue: "PNE Forum",
      artists: ["Fred again.."],
      offsetDays: -20,
      position: 3,
      reviews: [
        { user: "chloe", music: 10, crowd: 10, production: 9, venue: 7, text: "Cried twice, danced the rest. Fred turns a barn into a living room." },
        { user: "ravedaddy", music: 9, crowd: 10, production: 9, venue: 6, text: "Pure catharsis. The Forum is ugly but the crowd made it holy." },
        { user: "binibopper", music: 9, crowd: 9, production: 8, venue: 6, text: "Watching him sample the crowd live never gets old. Genuine magic." },
        { user: "bob", music: 8, crowd: 9, production: 8, venue: 6, text: "Beautiful set, but the sightlines on the floor were rough." },
      ],
    },
    {
      name: "Peggy Gou",
      venue: "Celebrities",
      artists: ["Peggy Gou"],
      offsetDays: -90,
      position: 2,
      reviews: [
        { user: "alice", music: 8, crowd: 8, production: 7, venue: 7, text: "Groovy and stylish, though a few too many phones in the air." },
        { user: "dynamik", music: 9, crowd: 8, production: 7, venue: 7, text: "(It Goes Like) Nanana on that system — instant serotonin." },
        { user: "ravebae", music: 7, crowd: 7, production: 6, venue: 7, text: "Fun but short — felt like it ended just as it peaked." },
      ],
    },
    {
      name: "RÜFÜS DU SOL",
      venue: "Vancouver Convention Centre",
      artists: ["RÜFÜS DU SOL"],
      offsetDays: -12,
      position: 3,
      reviews: [
        { user: "bob", music: 9, crowd: 8, production: 10, venue: 7, text: "Live drums plus that light show equals full-body goosebumps. Production a clean 10." },
        { user: "nabster", music: 9, crowd: 9, production: 10, venue: 7, text: "Underwater into Innerbloom destroyed me. Stunning visuals." },
        { user: "binibopper", music: 8, crowd: 8, production: 9, venue: 7, text: "Gorgeous, but it's a strangely seated-feeling room for a dancing act." },
        { user: "chloe", music: 9, crowd: 9, production: 10, venue: 8, text: "Transcendent. Did not expect to feel that much at a show." },
      ],
    },
    {
      name: "Bicep — Isles Live",
      venue: "Commodore Ballroom",
      artists: ["Bicep"],
      offsetDays: -5,
      position: 2,
      reviews: [
        { user: "dynamik", music: 9, crowd: 8, production: 9, venue: 9, text: "Glue, Apricots, Opal — the visuals melted into the breakbeats perfectly." },
        { user: "ravedaddy", music: 8, crowd: 8, production: 9, venue: 9, text: "Belfast's finest. The Commodore floor bounced the entire night." },
        { user: "alice", music: 8, crowd: 7, production: 9, venue: 9, text: "Dreamy and propulsive, though the crowd thinned oddly toward the end." },
      ],
    },
    // ---------- Upcoming (no reviews yet) ----------
    { name: "Sara Landry — Hekate", venue: "Open Studios", artists: ["Sara Landry"], offsetDays: 14, position: 3 },
    { name: "KETTAMA", venue: "Fortune Sound Club", artists: ["KETTAMA"], offsetDays: 21, position: 2 },
    { name: "Four Tet", venue: "Commodore Ballroom", artists: ["Four Tet"], offsetDays: 30, position: 2 },
    { name: "Skrillex", venue: "PNE Forum", artists: ["Skrillex"], offsetDays: 45, position: 3 },
    { name: "Overmono", venue: "The Pearl", artists: ["Overmono"], offsetDays: 9, position: 2 },
  ];

  const now = Date.now();
  const day = 86_400_000;

  const eventRows = await db
    .insert(schema.events)
    .values(
      eventDefs.map((e) => ({
        name: e.name,
        venueId: V[e.venue]!,
        brandId: e.brand ? contact!.id : null,
        startsAt: new Date(now + e.offsetDays * day),
      })),
    )
    .returning();

  // One headliner set per event.
  const setRows = await db
    .insert(schema.sets)
    .values(eventDefs.map((e, i) => ({ eventId: eventRows[i]!.id, isHeadliner: true, position: e.position })))
    .returning();

  // Set artists — "primary" for solo, "b2b" when more than one.
  await db.insert(schema.setArtists).values(
    eventDefs.flatMap((e, i) =>
      e.artists.map((name) => ({
        setId: setRows[i]!.id,
        artistId: A[name]!,
        role: e.artists.length > 1 ? "b2b" : "primary",
      })),
    ),
  );

  // Attendance + reviews derived from the review defs (every reviewer attended).
  const attendanceVals = eventDefs.flatMap((e, i) =>
    (e.reviews ?? []).map((r) => ({ userId: U[r.user]!, eventId: eventRows[i]!.id })),
  );
  const reviewVals = eventDefs.flatMap((e, i) =>
    (e.reviews ?? []).map((r) => ({
      userId: U[r.user]!,
      eventId: eventRows[i]!.id,
      music: r.music,
      crowd: r.crowd,
      production: r.production,
      venue: r.venue,
      text: r.text ?? null,
    })),
  );
  await db.insert(schema.attendance).values(attendanceVals);
  await db.insert(schema.reviews).values(reviewVals);

  // A few set ratings on headliner sets (raters are attendees above).
  await db.insert(schema.setRatings).values([
    { userId: U.alice!, setId: setRows[0]!.id, score: 9 },
    { userId: U.bob!, setId: setRows[0]!.id, score: 8 },
    { userId: U.nabster!, setId: setRows[0]!.id, score: 9 },
    { userId: U.alice!, setId: setRows[1]!.id, score: 10 },
    { userId: U.chloe!, setId: setRows[1]!.id, score: 9 },
    { userId: U.nabster!, setId: setRows[3]!.id, score: 10 },
    { userId: U.dynamik!, setId: setRows[3]!.id, score: 9 },
    { userId: U.chloe!, setId: setRows[4]!.id, score: 10 },
  ]);

  console.log(
    `seed complete: ${userRows.length} users, ${venueRows.length} venues, ${artistRows.length} artists, ` +
      `${eventRows.length} events, ${reviewVals.length} reviews.`,
  );
}

await main();
await sqlClient.end();
