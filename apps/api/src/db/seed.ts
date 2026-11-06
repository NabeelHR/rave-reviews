import { db, schema, sqlClient } from "./client.js";

// Vancouver seed. Small on purpose — enough to make read endpoints look real.
// Wipe-and-reseed each run.

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

  // Stable IDs: pinned so the iteration-1 "paste an existing user id" auth stub
  // keeps working across reseeds (otherwise every seed mints fresh UUIDs).
  const [alice, bob, chloe] = await db
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

  const [celebrities, harbourConvention, fortuneSound, openStudios] = await db
    .insert(schema.venues)
    .values([
      { name: "Celebrities", city: "Vancouver", region: "BC", country: "CA", capacity: 800 },
      {
        name: "Vancouver Convention Centre",
        city: "Vancouver",
        region: "BC",
        country: "CA",
        capacity: 5000,
      },
      { name: "Fortune Sound Club", city: "Vancouver", region: "BC", country: "CA", capacity: 400 },
      { name: "Open Studios", city: "Vancouver", region: "BC", country: "CA", capacity: 500 },
    ])
    .returning();

  const [contact] = await db
    .insert(schema.brands)
    .values([{ name: "Contact Winter Music Festival" }])
    .returning();

  const [johnSummit, chrisLake, fisher, sara, kettama] = await db
    .insert(schema.artists)
    .values([
      { name: "John Summit", canonicalName: "john summit" },
      { name: "Chris Lake", canonicalName: "chris lake" },
      { name: "FISHER", canonicalName: "fisher" },
      { name: "Sara Landry", canonicalName: "sara landry" },
      { name: "KETTAMA", canonicalName: "kettama" },
    ])
    .returning();

  const now = new Date();
  const day = 86_400_000;

  const [pastJs, pastLakeFisher, upcomingLandry, upcomingKettama] = await db
    .insert(schema.events)
    .values([
      {
        name: "John Summit — Experts Only",
        venueId: harbourConvention!.id,
        startsAt: new Date(now.getTime() - 30 * day),
      },
      {
        name: "Chris Lake b2b FISHER",
        venueId: celebrities!.id,
        brandId: contact!.id,
        startsAt: new Date(now.getTime() - 60 * day),
      },
      {
        name: "Sara Landry — Hekate",
        venueId: openStudios!.id,
        startsAt: new Date(now.getTime() + 14 * day),
      },
      {
        name: "KETTAMA",
        venueId: fortuneSound!.id,
        startsAt: new Date(now.getTime() + 21 * day),
      },
    ])
    .returning();

  // Sets — headliners flagged.
  const [jsHead] = await db
    .insert(schema.sets)
    .values([{ eventId: pastJs!.id, isHeadliner: true, position: 3 }])
    .returning();

  const [lakeFisherHead] = await db
    .insert(schema.sets)
    .values([{ eventId: pastLakeFisher!.id, isHeadliner: true, position: 2 }])
    .returning();

  const [landryHead] = await db
    .insert(schema.sets)
    .values([{ eventId: upcomingLandry!.id, isHeadliner: true, position: 3 }])
    .returning();

  const [kettamaHead] = await db
    .insert(schema.sets)
    .values([{ eventId: upcomingKettama!.id, isHeadliner: true, position: 2 }])
    .returning();

  await db.insert(schema.setArtists).values([
    { setId: jsHead!.id, artistId: johnSummit!.id, role: "primary" },
    // B2B: two artists on one headline set
    { setId: lakeFisherHead!.id, artistId: chrisLake!.id, role: "b2b" },
    { setId: lakeFisherHead!.id, artistId: fisher!.id, role: "b2b" },
    { setId: landryHead!.id, artistId: sara!.id, role: "primary" },
    { setId: kettamaHead!.id, artistId: kettama!.id, role: "primary" },
  ]);

  // Attendance + reviews on past events.
  await db.insert(schema.attendance).values([
    { userId: alice!.id, eventId: pastJs!.id },
    { userId: bob!.id, eventId: pastJs!.id },
    { userId: alice!.id, eventId: pastLakeFisher!.id },
    { userId: chloe!.id, eventId: pastLakeFisher!.id },
  ]);

  await db.insert(schema.reviews).values([
    {
      userId: alice!.id,
      eventId: pastJs!.id,
      music: 9,
      crowd: 8,
      production: 10,
      venue: 7,
      text: "Cathedral of house. Rig held up.",
    },
    {
      userId: bob!.id,
      eventId: pastJs!.id,
      music: 8,
      crowd: 7,
      production: 9,
      venue: 6,
      text: "Great set, room too big.",
    },
    {
      userId: alice!.id,
      eventId: pastLakeFisher!.id,
      music: 9,
      crowd: 10,
      production: null, // "N/A" — bare warehouse night
      venue: 8,
      text: "Sweat-dripping-off-the-ceiling night.",
    },
    {
      userId: chloe!.id,
      eventId: pastLakeFisher!.id,
      music: 8,
      crowd: 9,
      production: null,
      venue: 8,
    },
  ]);

  await db.insert(schema.setRatings).values([
    { userId: alice!.id, setId: jsHead!.id, score: 9 },
    { userId: bob!.id, setId: jsHead!.id, score: 8 },
    { userId: alice!.id, setId: lakeFisherHead!.id, score: 10 },
  ]);

  console.log("seed complete. sample IDs:");
  console.log({
    users: {
      alice: alice!.id,
      bob: bob!.id,
      chloe: chloe!.id,
      nabster: "00000000-0000-4000-8000-000000000004",
      dynamik: "00000000-0000-4000-8000-000000000005",
      ravedaddy: "00000000-0000-4000-8000-000000000006",
      ravebae: "00000000-0000-4000-8000-000000000007",
      binibopper: "00000000-0000-4000-8000-000000000008",
    },
    events: {
      pastJohnSummit: pastJs!.id,
      pastLakeFisher: pastLakeFisher!.id,
      upcomingLandry: upcomingLandry!.id,
      upcomingKettama: upcomingKettama!.id,
    },
    artists: { johnSummit: johnSummit!.id, chrisLake: chrisLake!.id, fisher: fisher!.id },
  });
}

await main();
await sqlClient.end();
