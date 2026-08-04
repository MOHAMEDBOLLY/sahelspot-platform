/** ============================================================
 * NORTH COAST REFERENCE DATASET — canonical source of truth
 * ============================================================
 *
 * This file is the canonical, project-wide reference for every
 * village/compound/area on Egypt's North Coast that SahelSpot has business
 * data for. It is **not** Home-specific and **not** temporary — it is meant
 * to power Home ordering today, and destination metadata, road-KM display,
 * search, regional grouping, SEO, and filters as those features are built,
 * all without any API or database change (this is a static frontend
 * reference table, same category as `lib/home/activities.ts`).
 *
 * ## Road KM values are business data, not computed geometry
 *
 * Every `roadKmStart`/`roadKmEnd` value below is transcribed directly from
 * the approved North Coast kilometer-marker reference list (the real,
 * physically-posted road markers along the Alexandria -> Marsa Matrouh
 * highway that visitors actually navigate by). **These values must never be
 * computed from GPS coordinates, latitude/longitude, or any distance
 * formula (including Haversine).** An earlier version of this file did
 * compute them that way — that approach is retired and must not return.
 * Where the source list gave no KM figure at all (the four Matrouh-section
 * entries), both fields are `null` — never backfilled by calculation.
 *
 * ## `travelOrder` vs. `roadKmStart`
 *
 * `travelOrder` is the real westbound driving sequence (Alexandria -> Marsa
 * Matrouh) as a plain integer, assigned by hand from the source list's own
 * order — it is not alphabetical and not re-derived from `roadKmStart` at
 * read time, even though for every entry that has a KM figure the two agree
 * (lower KM = earlier in the sequence). The four Matrouh entries have no KM
 * at all, so `travelOrder` is what actually places them (last, after
 * Baghoush) — this is exactly why the two fields are kept separate rather
 * than computing one from the other.
 *
 * ## Future destination metadata belongs here, not in a Home-specific file
 *
 * Anything that describes a North Coast place in general (its area, its
 * aliases, eventually a theme color or hero image) belongs as a field on
 * this file's entries — `lib/home/destinationOrder.ts` is a thin, Home-
 * specific adapter over this file, not a second source of truth.
 */

export type NorthCoastArea =
  | "Marina"
  | "New Alamein"
  | "Sidi Abdel Rahman"
  | "Ghazala Bay"
  | "Ras El Hekma"
  | "Matrouh";

export type NorthCoastReferenceEntry = {
  /** Stable internal key for this reference row. Derived from the English
   * name where the source gave one, otherwise a transliteration of the
   * Arabic name — an engineering identifier, not a claim about the
   * "correct" English name (see `nameEn`/`nameAr`). */
  id: string;
  /** Arabic name exactly as given in the source list (or, for the one
   * manually-added entry — New Alamein City — its real official Arabic
   * name; see that entry's own `notes`). */
  nameAr: string;
  /** English name, only where the source itself supplied one in
   * parentheses, or (New Alamein City only) its real official English
   * name. Never translated or invented otherwise — `null` if neither
   * applies. */
  nameEn: string | null;
  /** Real westbound driving sequence — see the file-level comment. Lower
   * runs first. Not alphabetical, not re-derived from `roadKmStart`. */
  travelOrder: number;
  /** Real road KM marker (start of range), copied verbatim from the
   * approved business reference. `null` only where the source gave no
   * figure at all — never computed, never estimated from coordinates. */
  roadKmStart: number | null;
  /** Real road KM marker (end of range). Equal to `roadKmStart` for a
   * point location (e.g. Marassi: 125–125); wider for a large development
   * the source itself gave a range for (e.g. Marina: 94–111). `null`
   * exactly when `roadKmStart` is `null`. */
  roadKmEnd: number | null;
  /** The ready-to-render display string for this entry's road KM — e.g.
   * "KM 94–111", "KM 125". `null` exactly when `roadKmStart` is `null`.
   * This is the one place a "KM ..." string is ever assembled: components
   * must render this value as-is, never build their own KM string from
   * `roadKmStart`/`roadKmEnd`. */
  travelLabel: string | null;
  /** First-class area/zone grouping — will power future filters, regional
   * grouping, and SEO. Six real North Coast areas (see `NorthCoastArea`).
   * Assigned from: (a) the source list's own explicit sub-heading
   * ("Ghazala Bay area" villages), (b) a name that self-identifies its
   * area (several entries literally contain "رأس الحكمة"/"Ras El Hekma"
   * in their own name), (c) for the Sidi Abdel Rahman cluster, direct
   * corroboration from this project's own `Destination.region` column
   * (`api/app/db/models.py` / `DESTINATION_REGIONS`), which already
   * stores "Sidi Abdelrahman Area" for the live destinations in that
   * cluster. The three KM-120 entries with no more specific naming
   * (Hamra Port/Bo Island/Lazurde Bay) are assigned "New Alamein" as the
   * administrative city's real span covers that stretch — flagged in
   * their own `notes` as the one area judgment call in this file that
   * isn't a direct name/source match, in case it needs correcting. */
  area: NorthCoastArea;
  /** `true` for an entry that is itself a real destination (a village,
   * compound, or city someone would name as "where they're going") —
   * `false` for a hotel, port, or resort-only entry that exists inside or
   * alongside a destination rather than being one itself. Assigned
   * mechanically from the source list's own Arabic prefix: "قرية"
   * (village) or "مدينة" (city) -> `true`; "فندق" (hotel), "منتجع" (resort,
   * when it's the *only* descriptor), or "ميناء" (port) -> `false`. This
   * is a direct reading of the source's own wording, not a judgment call. */
  isDestination: boolean;
  /** Free-text context carried from the source row, or explaining a
   * product decision made about this entry — never fabricated data about
   * the place itself. */
  notes: string | null;
  /** The matching `Destination.id` (`api/app/db/models.py`) ids in the
   * live SahelSpot dataset. Always an array, even for the common case of
   * exactly one id — this is what lets one reference entry represent more
   * than one live destination (Hacienda White/Red both link here to the
   * same entry) without a union type at every call site. Empty array when
   * this reference entry has no live SahelSpot destination yet (true for
   * most rows today). */
  linkedDestinationIds: readonly string[];
  /** Alternate names this entry is known by. Populated today only where a
   * product decision explicitly introduced an alias (Hacienda White/Red;
   * Ghazala Bay/Almaza Bay); reserved/empty elsewhere — the source list
   * gave one name (plus an optional English parenthetical, already in
   * `nameEn`) per row, so there's nothing else to record yet. */
  aliases: readonly string[];

  // --- Reserved for future use — deliberately unpopulated by this file ---
  /** Reserved for a future editorial/content status. Not populated. */
  status?: string;
  /** Reserved for a future per-area accent color (map pins/cards). Not
   * populated. */
  themeColor?: string;
  /** Reserved for a future reference-level hero image, independent of
   * Studio's own `cover_image_url`. Not populated. */
  heroImage?: string;
};

export const NORTH_COAST_REFERENCE: readonly NorthCoastReferenceEntry[] = [
  // ---------- Marina ----------
  {
    id: "marina",
    nameAr: "قرية مارينا العلمين (مارينا)",
    nameEn: "Marina",
    travelOrder: 1,
    roadKmStart: 94,
    roadKmEnd: 111,
    travelLabel: "KM 94–111",
    area: "Marina",
    isDestination: true,
    notes: null,
    linkedDestinationIds: ["marina"],
    aliases: [],
  },
  {
    id: "porto-marina",
    nameAr: "بورتو مارينا",
    nameEn: "Porto Marina",
    travelOrder: 2,
    roadKmStart: 97,
    roadKmEnd: 97,
    travelLabel: "KM 97",
    area: "Marina",
    isDestination: true,
    notes: "Inside Marina Alamein Village – Gate 3",
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "marina-gate-5",
    nameAr: "قرية مارينا العلمين – بوابة 5",
    nameEn: null,
    travelOrder: 3,
    roadKmStart: 100,
    roadKmEnd: 100,
    travelLabel: "KM 100",
    area: "Marina",
    isDestination: true,
    notes: "Marina Alamein Village – Gate 5",
    linkedDestinationIds: [],
    aliases: [],
  },

  // ---------- New Alamein (product decision — manually mapped) ----------
  {
    id: "new-alamein-city",
    nameAr: "مدينة العلمين الجديدة",
    nameEn: "New Alamein City",
    travelOrder: 4,
    roadKmStart: 101,
    roadKmEnd: 101,
    travelLabel: "KM 101",
    area: "New Alamein",
    isDestination: true,
    notes:
      "Not a row in the approved source list — manually mapped per product decision, since the live SahelSpot destination represents the New Alamein City administrative area as a whole rather than one specific compound.",
    linkedDestinationIds: ["new-alamein"],
    aliases: ["New Alamein", "El Alamein El Gedida"],
  },

  {
    id: "porto-marina-golf-resort",
    nameAr: "فندق ومنتجع جولف بورتو مارينا",
    nameEn: null,
    travelOrder: 5,
    roadKmStart: 105,
    roadKmEnd: 105,
    travelLabel: "KM 105",
    area: "Marina",
    isDestination: false,
    notes: "Porto Marina golf hotel & resort",
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "hamra-port-wepco",
    nameAr: "ميناء الحمرا لشركة ويبكو",
    nameEn: null,
    travelOrder: 6,
    roadKmStart: 120,
    roadKmEnd: 120,
    travelLabel: "KM 120",
    area: "New Alamein",
    isDestination: false,
    notes: "Area judgment call, not a direct name/source match — see the `area` field's own docstring above.",
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "bo-island-martin-beach",
    nameAr: "بو أيلاند – مارتين بيتش",
    nameEn: "Bo Island – Martin Beach",
    travelOrder: 7,
    roadKmStart: 120,
    roadKmEnd: 120,
    travelLabel: "KM 120",
    area: "New Alamein",
    isDestination: true,
    notes: "Area judgment call, not a direct name/source match — see the `area` field's own docstring above.",
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "lazurde-bay-resort",
    nameAr: "منتجع لازوردي باي",
    nameEn: "Lazurde Bay",
    travelOrder: 8,
    roadKmStart: 120,
    roadKmEnd: 120,
    travelLabel: "KM 120",
    area: "New Alamein",
    isDestination: false,
    notes: "Area judgment call, not a direct name/source match — see the `area` field's own docstring above.",
    linkedDestinationIds: [],
    aliases: [],
  },

  // ---------- Sidi Abdel Rahman ----------
  {
    id: "loulouet-heliopolis",
    nameAr: "قرية لؤلؤة هليوبوليس",
    nameEn: null,
    travelOrder: 9,
    roadKmStart: 124,
    roadKmEnd: 124,
    travelLabel: "KM 124",
    area: "Sidi Abdel Rahman",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "marseilles-beach-4",
    nameAr: "قرية مارسيليا بيتش 4",
    nameEn: "Marseilles Beach 4",
    travelOrder: 10,
    roadKmStart: 124,
    roadKmEnd: 124,
    travelLabel: "KM 124",
    area: "Sidi Abdel Rahman",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "hacienda-bay",
    nameAr: "قرية هاسيندا باي",
    nameEn: "Hacienda Bay",
    travelOrder: 11,
    roadKmStart: 124,
    roadKmEnd: 124,
    travelLabel: "KM 124",
    area: "Sidi Abdel Rahman",
    isDestination: true,
    notes: "Palm Hills Developments",
    linkedDestinationIds: ["hacienda-bay"],
    aliases: [],
  },
  {
    id: "marassi",
    nameAr: "قرية مراسي",
    nameEn: null,
    travelOrder: 12,
    roadKmStart: 125,
    roadKmEnd: 125,
    travelLabel: "KM 125",
    area: "Sidi Abdel Rahman",
    isDestination: true,
    notes: null,
    linkedDestinationIds: ["marassi"],
    aliases: [],
  },
  {
    id: "diplomacyeen-3",
    nameAr: "قرية الدبلوماسيين 3",
    nameEn: null,
    travelOrder: 13,
    roadKmStart: 126,
    roadKmEnd: 126,
    travelLabel: "KM 126",
    area: "Sidi Abdel Rahman",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "al-karma",
    nameAr: "قرية الكرمة",
    nameEn: null,
    travelOrder: 14,
    roadKmStart: 132,
    roadKmEnd: 132,
    travelLabel: "KM 132",
    area: "Sidi Abdel Rahman",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "orchidia-resort",
    nameAr: "قرية ومنتجع أوركيديا ريزوت بشاطئ الهنا",
    nameEn: "Orchidia Resort",
    travelOrder: 15,
    roadKmStart: 133,
    roadKmEnd: 133,
    travelLabel: "KM 133",
    area: "Sidi Abdel Rahman",
    isDestination: true,
    notes: "At Al Hana Beach — source names it both a village (قرية) and a resort",
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "stella-heights",
    nameAr: "قرية ستيلا هايتس",
    nameEn: "Stella Heights",
    travelOrder: 16,
    roadKmStart: 134,
    roadKmEnd: 134,
    travelLabel: "KM 134",
    area: "Sidi Abdel Rahman",
    isDestination: true,
    notes: null,
    linkedDestinationIds: ["stella-heights"],
    aliases: [],
  },
  {
    id: "seashell",
    nameAr: "قرية سي شيل",
    nameEn: null,
    travelOrder: 17,
    roadKmStart: 134,
    roadKmEnd: 134,
    travelLabel: "KM 134",
    area: "Sidi Abdel Rahman",
    isDestination: true,
    notes: null,
    linkedDestinationIds: ["seashell"],
    aliases: [],
  },
  {
    id: "bianchi",
    nameAr: "قرية بيانكي",
    nameEn: "Bianchi",
    travelOrder: 18,
    roadKmStart: 134,
    roadKmEnd: 134,
    travelLabel: "KM 134",
    area: "Sidi Abdel Rahman",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "amwaj",
    nameAr: "قرية أمواج",
    nameEn: null,
    travelOrder: 19,
    roadKmStart: 136,
    roadKmEnd: 136,
    travelLabel: "KM 136",
    area: "Sidi Abdel Rahman",
    isDestination: true,
    notes: "Sabbour – National Real Estate Development (الأهلي للتنمية العقارية)",
    linkedDestinationIds: ["amwaj"],
    aliases: [],
  },
  {
    // Product decision: Hacienda Red is not kept as an independent entry —
    // the source list only ever had one Hacienda-White row (KM 140); the
    // live SahelSpot dataset's separate "hacienda-red" destination links
    // here too, as an alias of this same real-world development.
    id: "hacienda-white",
    nameAr: "قرية هاسيندا وايت",
    nameEn: "Hacienda White",
    travelOrder: 20,
    roadKmStart: 140,
    roadKmEnd: 140,
    travelLabel: "KM 140",
    area: "Sidi Abdel Rahman",
    isDestination: true,
    notes:
      "Palm Hills Developments. Product decision: canonical entry for both Studio destinations \"Hacienda White\" and \"Hacienda Red\" — the source list never had a separate Hacienda Red row.",
    linkedDestinationIds: ["hacienda-white", "hacienda-red"],
    aliases: ["Hacienda White", "Hacienda Red"],
  },
  {
    id: "telal-alamein",
    nameAr: "قرية تلال العلمين",
    nameEn: null,
    travelOrder: 21,
    roadKmStart: 141,
    roadKmEnd: 141,
    travelLabel: "KM 141",
    area: "Sidi Abdel Rahman",
    isDestination: true,
    notes: null,
    linkedDestinationIds: ["telal"],
    aliases: [],
  },

  // ---------- Ghazala Bay ----------
  {
    id: "ghazala-valley",
    nameAr: "قرية غزالة الوادي",
    nameEn: "Ghazala Valley",
    travelOrder: 22,
    roadKmStart: 142,
    roadKmEnd: 142,
    travelLabel: "KM 142",
    area: "Ghazala Bay",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    // Product decision: the live SahelSpot destination currently named
    // "Almaza Bay" is replaced, business-wise, by "Ghazala Bay" — the
    // approved reference list identifies this area as Ghazala Bay.
    // "Almaza Bay" is kept only as a compatibility alias until Studio's
    // destination naming is standardized to match. Not renamed in Studio
    // yet — see this entry's `notes`.
    id: "ghazala-bay",
    nameAr: "قرية خليج غزالة",
    nameEn: "Ghazala Bay",
    travelOrder: 23,
    roadKmStart: 142,
    roadKmEnd: 142,
    travelLabel: "KM 142",
    area: "Ghazala Bay",
    isDestination: true,
    notes:
      "Product decision: canonical entry for the live SahelSpot destination currently named \"Almaza Bay\" — that name is kept as a compatibility alias only, pending Studio destination-name standardization. Do not rename the live Studio destination yet.",
    linkedDestinationIds: ["almaza-bay"],
    aliases: ["Ghazala Bay", "Almaza Bay"],
  },
  {
    id: "rixos-alamein-hotel",
    nameAr: "فندق ريكسوس العلمين",
    nameEn: "Rixos Alamein Hotel",
    travelOrder: 24,
    roadKmStart: 142,
    roadKmEnd: 142,
    travelLabel: "KM 142",
    area: "Ghazala Bay",
    isDestination: false,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "coronado",
    nameAr: "قرية كورونادو",
    nameEn: "Coronado",
    travelOrder: 25,
    roadKmStart: 164,
    roadKmEnd: 164,
    travelLabel: "KM 164",
    area: "Ghazala Bay",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "lasirena",
    nameAr: "قرية لاسيرينا",
    nameEn: "Lasirena",
    travelOrder: 26,
    roadKmStart: 165,
    roadKmEnd: 165,
    travelLabel: "KM 165",
    area: "Ghazala Bay",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },

  // ---------- Ras El Hekma ----------
  {
    id: "la-vista-bay",
    nameAr: "قرية لافيستا باي",
    nameEn: "La Vista Bay",
    travelOrder: 27,
    roadKmStart: 176,
    roadKmEnd: 176,
    travelLabel: "KM 176",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "la-mora-beach",
    nameAr: "قرية لامورا بيتش",
    nameEn: null,
    travelOrder: 28,
    roadKmStart: 178,
    roadKmEnd: 178,
    travelLabel: "KM 178",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "emirates-heights",
    nameAr: "قرية الإمارات هايتس",
    nameEn: "Emirates Heights",
    travelOrder: 29,
    roadKmStart: 179,
    roadKmEnd: 179,
    travelLabel: "KM 179",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "the-shore",
    nameAr: "قرية ذا شور",
    nameEn: "The Shore",
    travelOrder: 30,
    roadKmStart: 186,
    roadKmEnd: 186,
    travelLabel: "KM 186",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "sea-view",
    nameAr: "قرية سي فيو",
    nameEn: "Sea View",
    travelOrder: 31,
    roadKmStart: 187,
    roadKmEnd: 187,
    travelLabel: "KM 187",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "coral-hills",
    nameAr: "قرية كورال هيلز",
    nameEn: "Coral Hills",
    travelOrder: 32,
    roadKmStart: 187,
    roadKmEnd: 187,
    travelLabel: "KM 187",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "lamera",
    nameAr: "قرية لاميرا",
    nameEn: "Lamera",
    travelOrder: 33,
    roadKmStart: 190,
    roadKmEnd: 190,
    travelLabel: "KM 190",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "jevera-bay",
    nameAr: "قرية جيفيرا باي",
    nameEn: "Jevera Bay",
    travelOrder: 34,
    roadKmStart: 191,
    roadKmEnd: 191,
    travelLabel: "KM 191",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "swan-lake",
    nameAr: "قرية سوان ليك",
    nameEn: "Swan Lake",
    travelOrder: 35,
    roadKmStart: 198,
    roadKmEnd: 198,
    travelLabel: "KM 198",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "mountain-view-diplomacyeen",
    nameAr: "قرية ماونتين فيو الدبلوماسيين",
    nameEn: "Mountain View Diplomacyeen",
    travelOrder: 36,
    roadKmStart: 200,
    roadKmEnd: 200,
    travelLabel: "KM 200",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "mountain-view-ras-el-hekma",
    nameAr: "قرية ماونتين فيو رأس الحكمة",
    nameEn: "Mountain View Ras El Hekma",
    travelOrder: 37,
    roadKmStart: 200,
    roadKmEnd: 200,
    travelLabel: "KM 200",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "caesar-bay-resort-hotel",
    nameAr: "فندق سيزر باي",
    nameEn: "Caesar Bay Resort",
    travelOrder: 38,
    roadKmStart: 201,
    roadKmEnd: 201,
    travelLabel: "KM 201",
    area: "Ras El Hekma",
    isDestination: false,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "caesar-sodic",
    nameAr: "قرية سيزر",
    nameEn: "Caesar",
    travelOrder: 39,
    roadKmStart: 201,
    roadKmEnd: 201,
    travelLabel: "KM 201",
    area: "Ras El Hekma",
    isDestination: true,
    notes: "SODIC",
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "mena-5",
    nameAr: "قرية مينا 5",
    nameEn: null,
    travelOrder: 40,
    roadKmStart: 202,
    roadKmEnd: 202,
    travelLabel: "KM 202",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "al-gawhara-ras-el-hekma",
    nameAr: "قرية الجوهرة رأس الحكمة",
    nameEn: null,
    travelOrder: 41,
    roadKmStart: 204,
    roadKmEnd: 204,
    travelLabel: "KM 204",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "royal-beach",
    nameAr: "قرية رويال بيتش",
    nameEn: "Royal Beach",
    travelOrder: 42,
    roadKmStart: 205,
    roadKmEnd: 205,
    travelLabel: "KM 205",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "itab-ras-el-hekma",
    nameAr: "قرية إيتاب رأس الحكمة",
    nameEn: null,
    travelOrder: 43,
    roadKmStart: 212,
    roadKmEnd: 212,
    travelLabel: "KM 212",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "jumeirah-bay-fouka-bay",
    nameAr: "قرية چميرا باي – خليج فوكة",
    nameEn: "Jumeirah Bay",
    travelOrder: 44,
    roadKmStart: 214,
    roadKmEnd: 214,
    travelLabel: "KM 214",
    area: "Ras El Hekma",
    isDestination: true,
    notes: "Fouka Bay",
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "baghoush",
    nameAr: "قرية باغوش",
    nameEn: null,
    travelOrder: 45,
    roadKmStart: 214,
    roadKmEnd: 214,
    travelLabel: "KM 214",
    area: "Ras El Hekma",
    isDestination: true,
    notes: null,
    linkedDestinationIds: [],
    aliases: [],
  },

  // ---------- Matrouh — source gave no KM figure for these four ----------
  {
    id: "al-abd-sidi-haneish",
    nameAr: "قرية العبد – سيدي حنيش",
    nameEn: null,
    travelOrder: 46,
    roadKmStart: null,
    roadKmEnd: null,
    travelLabel: null,
    area: "Matrouh",
    isDestination: true,
    notes: "Sidi Haneish. Source gave no KM figure — left null rather than estimated.",
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "jaz-almaza-beach-resort",
    nameAr: "فندق جاز ألماظة بيتش ريزورت",
    nameEn: "Jaz Almaza Beach Resort",
    travelOrder: 47,
    roadKmStart: null,
    roadKmEnd: null,
    travelLabel: null,
    area: "Matrouh",
    isDestination: false,
    notes:
      "A specific hotel, distinct from the \"Ghazala Bay\" area entry above that the live \"Almaza Bay\" destination is now linked to. Source gave no KM figure — left null rather than estimated.",
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "garawla-bay",
    nameAr: "قرية جراولة باي",
    nameEn: "Garawla Bay",
    travelOrder: 48,
    roadKmStart: null,
    roadKmEnd: null,
    travelLabel: null,
    area: "Matrouh",
    isDestination: true,
    notes: "Source gave no KM figure — left null rather than estimated.",
    linkedDestinationIds: [],
    aliases: [],
  },
  {
    id: "andalusia",
    nameAr: "قرية أندلسية",
    nameEn: null,
    travelOrder: 49,
    roadKmStart: null,
    roadKmEnd: null,
    travelLabel: null,
    area: "Matrouh",
    isDestination: true,
    notes: "Source gave no KM figure — left null rather than estimated.",
    linkedDestinationIds: [],
    aliases: [],
  },
] as const;

/** Live SahelSpot destinations (`Destination.id`) with no linked reference
 * entry above. Empty today — every live destination has been resolved to a
 * reference entry via an explicit product decision (New Alamein City,
 * Hacienda White/Red, Ghazala Bay/Almaza Bay) or a direct name match.
 * Kept as an explicit list (not just "absence of a match") so a future
 * destination that genuinely has no reference yet is a visible, documented
 * gap rather than a silent one — add its id here with a comment explaining
 * why, exactly like the entries above document their own product
 * decisions. */
export const KNOWN_GAPS: readonly string[] = [];

/** Looks up a reference entry by live SahelSpot destination id — the one
 * function anything reading this file for a live destination should use.
 * Checks `linkedDestinationIds` (always an array, even for the common
 * one-id case), since one reference entry can represent more than one live
 * destination (see Hacienda White/Red). */
export function findReferenceBySahelSpotId(destinationId: string): NorthCoastReferenceEntry | null {
  return NORTH_COAST_REFERENCE.find((entry) => entry.linkedDestinationIds.includes(destinationId)) ?? null;
}
