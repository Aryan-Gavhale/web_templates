/* =============================================================================
   Seed — a credible Indian dermatology practice, plus enough CRM traffic that
   every admin screen has something real to show on first run.

   Run:  npm run seed          (only if the database is empty)
         npm run reseed        (wipe and rebuild)

   Every word of clinical, pricing and review content here is invented for
   demonstration. Registration numbers, accreditations and patient records are
   fictitious. Replace all of it through the admin panel before this faces a
   real patient.
   ========================================================================== */

import { db, all, get, run, tx, putSetting } from './db.js';
import { hashPassword } from './lib/auth.js';
import { buildSchedule, addMonths, today, makeRef } from './lib/money.js';

const force = process.argv.includes('--force');

const existing = get('SELECT COUNT(*) AS n FROM users').n;
if (existing > 0 && !force) {
  console.log('\n  Database already has data. Use "npm run reseed" to wipe and rebuild.\n');
  process.exit(0);
}

const OWNER_EMAIL = process.env.SEED_ADMIN_EMAIL || 'owner@twacha.in';
const OWNER_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'TwachaAdmin2026';

/* Unsplash is used only as a stand-in. The front end swaps in a local
   placeholder if any of these fail to load, so a blocked network never leaves
   a broken image on the page. */
const img = (id, w = 1400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=72`;

/* -------------------------------------------------------------------------- */

const TABLES = [
  'activity_log', 'payments', 'installments', 'emi_plans', 'patients',
  'enquiry_notes', 'enquiries', 'google_cache', 'testimonials', 'locations',
  'doctors', 'services', 'categories', 'section_items', 'sections', 'media',
  'settings', 'sessions', 'users',
];

/* Hashed up front: hashing is asynchronous now, and nothing can be awaited
   inside the synchronous transaction below. */
const PASSWORD_HASHES = {
  owner: await hashPassword(OWNER_PASSWORD),
  reception: await hashPassword('FrontDesk2026'),
  manager: await hashPassword('ClinicManager2026'),
};

tx(() => {
  if (force) {
    db.exec('PRAGMA foreign_keys = OFF');
    for (const t of TABLES) run(`DELETE FROM ${t}`);
    run(`DELETE FROM sqlite_sequence`);
    db.exec('PRAGMA foreign_keys = ON');
  }

  /* ---- users ------------------------------------------------------------- */

  const ownerId = Number(run(
    `INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'owner')`,
    OWNER_EMAIL, 'Dr Aditi Deshmukh', PASSWORD_HASHES.owner
  ).lastInsertRowid);

  const frontDeskId = Number(run(
    `INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'staff')`,
    'reception@twacha.in', 'Sneha Kulkarni', PASSWORD_HASHES.reception
  ).lastInsertRowid);

  run(
    `INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'manager')`,
    'manager@twacha.in', 'Rohan Bhosale', PASSWORD_HASHES.manager
  );

  /* ---- settings ---------------------------------------------------------- */

  const SETTINGS = [
    ['clinic_name', 'TWACHA', 'text', 'clinic', 'Clinic name', 'Shown in the header, footer and page title', 1],
    ['clinic_subtitle', 'Skin, Hair & Laser Clinic', 'text', 'clinic', 'Descriptor', 'Sits beneath the name in the logo', 2],
    ['tagline', 'Dermatology that explains itself', 'text', 'clinic', 'Tagline', '', 3],
    ['phone', '+91 20 4120 8800', 'tel', 'clinic', 'Reception telephone', '', 4],
    ['whatsapp', '+919822041208', 'tel', 'clinic', 'WhatsApp number', 'Digits and + only — used to build the wa.me link', 5],
    ['email', 'hello@twacha.in', 'email', 'clinic', 'Email', '', 6],
    ['registration_note', 'Registered under the Maharashtra Nursing Homes Registration Act · Reg. PMC/NH/2017/2291', 'text', 'clinic', 'Registration note', 'Printed small in the footer', 7],

    ['whatsapp_message', 'Hello TWACHA, I would like to book a dermatology consultation.', 'longtext', 'booking', 'Pre-filled WhatsApp message', '', 1],
    ['consult_fee_note', 'Consultation ₹800 · adjusted against treatment booked within 30 days', 'text', 'booking', 'Consultation fee note', '', 2],
    ['emi_note', 'No-cost EMI on packages above ₹25,000 across 3, 6 and 9 months. Interest-bearing tenures up to 24 months are available on request.', 'longtext', 'booking', 'EMI note', 'Shown on the pricing and EMI section', 3],
    ['booking_hours_note', 'Calls returned between 9 am and 8 pm, Monday to Saturday', 'text', 'booking', 'Callback hours', '', 4],

    ['seo_title', 'TWACHA — Dermatology, Skin & Hair Clinic in Pune', 'text', 'seo', 'Page title', '', 1],
    ['seo_description', 'Consultant-led dermatology in Pune. Acne, pigmentation, hair loss, laser and skin surgery. Transparent pricing and no-cost EMI.', 'longtext', 'seo', 'Meta description', 'Around 155 characters reads best in search results', 2],

    ['instagram_url', 'https://instagram.com/twacha.skin', 'url', 'social', 'Instagram', 'Leave blank to hide the link', 1],
    ['facebook_url', '', 'url', 'social', 'Facebook', 'Leave blank to hide the link', 2],
    ['practo_url', '', 'url', 'social', 'Practo profile', 'Leave blank to hide the link', 3],

    ['show_google_badge', '1', 'bool', 'reviews', 'Show the Google rating badge', '', 1],
    ['reviews_heading', 'What patients say', 'text', 'reviews', 'Reviews heading', '', 2],
  ];

  for (const [key, value, kind, group, label, hint, sort] of SETTINGS) {
    run(
      `INSERT INTO settings (key, value, kind, group_name, label, hint, sort_order)
       VALUES (?,?,?,?,?,?,?)`,
      key, value, kind, group, label, hint, sort
    );
  }

  /* ---- media ------------------------------------------------------------- */

  const media = (url, alt, credit = 'Unsplash · placeholder') => Number(run(
    `INSERT INTO media (source, url, alt_text, credit, mime) VALUES ('url', ?, ?, ?, 'image/jpeg')`,
    url, alt, credit
  ).lastInsertRowid);

  const mHero = media(img('photo-1519974719765-e6559eac2575', 1800), 'TWACHA consulting room in Koregaon Park, Pune');
  const mReception = media(img('photo-1586773860418-d37222d8fce3'), 'Reception and waiting area');
  const mLaser = media(img('photo-1614859324967-bdf413c35a45'), 'Laser treatment suite');
  const mProcedure = media(img('photo-1629909613654-28e377c37b09'), 'Minor procedures room');
  const mCorridor = media(img('photo-1576091160399-112ba8d25d1d'), 'Consulting corridor');
  const mSkin = media(img('photo-1570172619644-dfd03ed5d881'), 'Skin close-up');

  const mDrAditi = media(img('photo-1580489944761-15a19d654956', 900), 'Dr Aditi Deshmukh');
  const mDrKabir = media(img('photo-1612349317150-e413f6a5b16d', 900), 'Dr Kabir Menon');
  const mDrMeera = media(img('photo-1594824476967-48c8b964273f', 900), 'Dr Meera Iyer');

  const sAcne = media(img('photo-1556228720-195a672e8a03', 900), 'Acne and scar treatment');
  const sPigment = media(img('photo-1596755094514-f87e34085b2c', 900), 'Pigmentation treatment');
  const sHair = media(img('photo-1522337360788-8b13dee7a37e', 900), 'Hair and scalp clinic');
  const sLaserSvc = media(img('photo-1600334089648-b0d9d3028eb2', 900), 'Laser hair reduction');

  /* ---- sections ---------------------------------------------------------- */

  const section = (row) => Number(run(
    `INSERT INTO sections (key, kind, eyebrow, title, subtitle, body, cta_label, cta_href, media_id, sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    row.key, row.kind, row.eyebrow ?? null, row.title ?? null, row.subtitle ?? null,
    row.body ?? null, row.cta_label ?? null, row.cta_href ?? null, row.media_id ?? null, row.sort
  ).lastInsertRowid);

  const item = (sectionId, row, sort) => run(
    `INSERT INTO section_items (section_id, title, body, value, suffix, media_id, sort_order)
     VALUES (?,?,?,?,?,?,?)`,
    sectionId, row.title ?? null, row.body ?? null, row.value ?? null,
    row.suffix ?? null, row.media_id ?? null, sort
  );

  const heroId = section({
    key: 'hero', kind: 'hero', sort: 1,
    eyebrow: 'Consultant-led dermatology · Pune',
    title: 'Skin answers you can actually follow.',
    subtitle: 'Two clinics in Pune. Every diagnosis explained in plain language, every price quoted before you agree to it, and treatment plans you can pay for monthly.',
    cta_label: 'Book a consultation', cta_href: '#booking',
    media_id: mHero,
  });
  [
    { title: 'MD Dermatology on every chair', body: 'No consultation is delegated to a technician.' },
    { title: 'Price quoted in writing', body: 'Before a single session is booked.' },
    { title: 'No-cost EMI from ₹25,000', body: 'Three, six or nine months.' },
  ].forEach((r, i) => item(heroId, r, i));

  const statsId = section({
    key: 'trust', kind: 'stats', sort: 2,
    eyebrow: 'The practice in numbers',
    title: 'Nine years, two clinics, one standard',
  });
  [
    { value: '12,400', suffix: '+', title: 'Patients treated', body: 'Since the Koregaon Park clinic opened in 2017.' },
    { value: '9', title: 'Years in practice', body: 'Under the same clinical leadership throughout.' },
    { value: '4.8', suffix: '/5', title: 'Google rating', body: 'Across both Pune clinics.' },
    { value: '38', suffix: ' min', title: 'Average first consultation', body: 'Long enough to examine, explain and plan.' },
  ].forEach((r, i) => item(statsId, r, i));

  const aboutId = section({
    key: 'about', kind: 'prose', sort: 3,
    eyebrow: 'How we work',
    title: 'Dermatology slows down when it is done properly.',
    body: 'Most skin problems are not solved in a single sitting, and a clinic that promises otherwise is selling something. A first consultation at TWACHA is thirty to forty minutes: history, examination under magnification, dermoscopy where it helps, and a written plan you take home.\n\nWhere a condition needs a biopsy, a blood panel or a second opinion, we say so. Where it needs nothing but a cleanser and eight weeks of patience, we say that too — and it happens more often than you would expect.',
    media_id: mCorridor,
  });
  [
    { title: 'Examination before treatment', body: 'Dermoscopy and photography at the first visit, so change is measured rather than remembered.' },
    { title: 'Written plans', body: 'You leave with the diagnosis, the plan, the cost and the expected timeline on paper.' },
    { title: 'One clinician throughout', body: 'The doctor who examined you is the doctor who reviews you.' },
    { title: 'Honest discharge', body: 'When a course is finished, we say it is finished.' },
  ].forEach((r, i) => item(aboutId, r, i));

  const journeyId = section({
    key: 'journey', kind: 'steps', sort: 4,
    eyebrow: 'What happens',
    title: 'Four steps, no surprises',
    subtitle: 'From the first phone call to the review appointment.',
  });
  [
    { value: '01', title: 'Enquiry', body: 'Call, WhatsApp or use the form. Reception will offer you the first suitable slot with the right clinician — not simply the first slot free.' },
    { value: '02', title: 'Consultation', body: 'Thirty to forty minutes. History, examination, dermoscopy where relevant, and photographs for the record. ₹800, adjusted against treatment booked within thirty days.' },
    { value: '03', title: 'Written plan and price', body: 'The plan, the number of sessions, the total cost and the EMI options if you want them. Nothing is booked until you have read it.' },
    { value: '04', title: 'Treatment and review', body: 'Sessions run to schedule. A review at the end of each course, with the photographs side by side.' },
  ].forEach((r, i) => item(journeyId, r, i));

  const galleryId = section({
    key: 'gallery', kind: 'gallery', sort: 5,
    eyebrow: 'The clinics',
    title: 'Koregaon Park and Baner',
    subtitle: 'Both clinics run the same equipment and the same protocols.',
  });
  [
    { media_id: mReception, title: 'Reception, Koregaon Park' },
    { media_id: mLaser, title: 'Laser suite' },
    { media_id: mProcedure, title: 'Minor procedures room' },
    { media_id: mCorridor, title: 'Consulting rooms' },
    { media_id: mSkin, title: 'Dermoscopy and imaging' },
    { media_id: mHero, title: 'Consulting room, Baner' },
  ].forEach((r, i) => item(galleryId, r, i));

  const emiId = section({
    key: 'emi', kind: 'emi', sort: 6,
    eyebrow: 'Paying for treatment',
    title: 'Long courses, monthly payments',
    subtitle: 'Laser packages, scar programmes and hair restoration can be spread across months. The total does not change on a no-cost tenure — that is what makes it no-cost.',
    body: 'Bring a PAN card and one address proof. Approval is usually the same day. There is no charge for asking, and choosing to pay in full costs you nothing extra either.',
    cta_label: 'Ask about EMI', cta_href: '#booking',
  });
  [
    { value: '3', suffix: ' months', title: 'No-cost', body: 'Packages from ₹25,000. Nothing added to the total.' },
    { value: '6', suffix: ' months', title: 'No-cost', body: 'Packages from ₹40,000. Nothing added to the total.' },
    { value: '9', suffix: ' months', title: 'No-cost', body: 'Packages from ₹60,000. Nothing added to the total.' },
    { value: '24', suffix: ' months', title: 'Extended', body: 'Interest-bearing, quoted in writing before you agree.' },
  ].forEach((r, i) => item(emiId, r, i));

  const faqId = section({
    key: 'faq', kind: 'faq', sort: 7,
    eyebrow: 'Before you come in',
    title: 'Questions worth asking',
  });
  [
    { title: 'Will one session fix my acne?', body: 'No, and any clinic that says otherwise is describing a sale rather than a treatment. Active acne typically settles over eight to twelve weeks of medical treatment. Scarring is a separate, later conversation, and it is only worth starting once the acne itself is quiet.' },
    { title: 'Is laser hair reduction permanent?', body: 'It is permanent reduction, not permanent removal — the accepted term is deliberate. Most patients see sixty to eighty per cent less growth after six to eight sessions, with occasional maintenance afterwards. Hormonal conditions such as PCOS change that arithmetic, and we will tell you before you book.' },
    { title: 'Do you treat children?', body: 'Yes. Paediatric eczema, birthmarks, warts and molluscum are a regular part of the clinic. Dr Meera Iyer holds the Thursday morning paediatric list at Koregaon Park.' },
    { title: 'What does the consultation cost?', body: '₹800, which is adjusted in full against any treatment booked within thirty days. A review within six weeks of the same complaint is not charged again.' },
    { title: 'Can I get a copy of my records?', body: 'Yes, on request, including the clinical photographs. They are your records. Ask at reception and they are emailed within two working days.' },
    { title: 'Do you offer no-cost EMI on everything?', body: 'No. It applies to packages above ₹25,000 — laser courses, scar programmes and hair restoration. Single consultations, medicines and one-off procedures are payable at the time.' },
  ].forEach((r, i) => item(faqId, r, i));

  section({
    key: 'closing', kind: 'cta', sort: 8,
    eyebrow: 'Next step',
    title: 'Bring the problem. We will bring the plan.',
    subtitle: 'Reception answers between 9 am and 8 pm, Monday to Saturday. Leave a number and you will be called back the same day.',
    cta_label: 'Request a callback', cta_href: '#booking',
  });

  /* ---- categories and services ------------------------------------------ */

  const cat = (name, slug, blurb, sort) => Number(run(
    'INSERT INTO categories (name, slug, blurb, sort_order) VALUES (?,?,?,?)',
    name, slug, blurb, sort
  ).lastInsertRowid);

  const cMedical = cat('Medical dermatology', 'medical', 'Conditions treated with medicine, not machines.', 1);
  const cSurgical = cat('Skin surgery', 'surgery', 'Day procedures under local anaesthetic.', 2);
  const cLaser = cat('Laser & energy', 'laser', 'Device-based treatment on a consultant-set protocol.', 3);
  const cHair = cat('Hair & scalp', 'hair', 'Trichology, medical management and restoration.', 4);
  const cAesthetic = cat('Aesthetic', 'aesthetic', 'Considered, conservative, and never sold on the day.', 5);

  const SERVICES = [
    [cMedical, 'acne-active', 'Active acne', 'Grading, medical treatment and a realistic timeline for clearance.',
      'Acne is graded at the first visit and treated medically before anything else is discussed. Most courses run eight to twelve weeks on topicals, with oral treatment where the grade justifies it. Isotretinoin, when indicated, is prescribed with monthly bloods and a written consent conversation — not handed out on a first visit.',
      35, '3–4 visits over 12 weeks', 80000, 250000, 'Consultation plus medicines; varies with grade', 0, 1, sAcne],
    [cMedical, 'pigmentation-melasma', 'Pigmentation & melasma', 'Sun-driven and hormonal pigmentation, treated slowly and properly.',
      'Melasma is controlled rather than cured, and the clinics that promise otherwise produce rebound. Treatment is a combination of strict photoprotection, topical agents and — only once the pigment is stable — carefully spaced peels or low-fluence laser.',
      30, '6–9 months of management', 120000, 450000, 'Course pricing quoted after assessment', 1, 1, sPigment],
    [cMedical, 'eczema-psoriasis', 'Eczema & psoriasis', 'Long-term inflammatory skin disease, managed as long-term disease.',
      'Chronic inflammatory skin disease needs a maintenance plan, not a rescue course. We set a flare protocol and a between-flare routine, review quarterly, and escalate to systemic or biologic therapy when severity and guidelines agree.',
      35, 'Quarterly review', 80000, null, 'Consultation; medicines separate', 0, 0, null],
    [cMedical, 'paediatric', 'Paediatric dermatology', 'Eczema, birthmarks, warts and molluscum in children.',
      'A dedicated paediatric list on Thursday mornings, with appointment lengths that allow for a child who does not want to be examined. Parents are given written instructions, because nobody remembers a moisturiser regimen in a busy clinic room.',
      30, 'As needed', 80000, null, 'Consultation', 0, 0, null],
    [cMedical, 'mole-check', 'Mole & skin cancer check', 'Dermoscopy, mapping and biopsy where it is warranted.',
      'Every mole check is a dermoscopic examination with photographic mapping, not a glance. Anything suspicious is either excised or referred the same week. We would rather take out a benign lesion than watch a melanoma.',
      30, 'Annual', 180000, null, 'Includes dermoscopy and mapping', 0, 1, null],

    [cSurgical, 'mole-removal', 'Mole & lesion removal', 'Excision or shave under local anaesthetic, with histology.',
      'Day procedure under local anaesthetic. Everything removed is sent for histology as a matter of course — there is no defensible reason to discard tissue. Sutures out at seven to ten days.',
      45, 'Single visit plus review', 450000, 900000, 'Per lesion; histology included', 1, 1, null],
    [cSurgical, 'scar-revision', 'Acne scar programme', 'Subcision, microneedling RF and resurfacing in a staged course.',
      'Scarring is assessed by type — rolling, boxcar, icepick — because each answers to a different technique and no single machine treats all three. A staged programme usually runs four to six sessions at six-week intervals, with photographs at every visit.',
      60, '4–6 sessions', 650000, 1800000, 'Package priced after assessment · EMI available', 1, 1, null],

    [cLaser, 'laser-hair-reduction', 'Laser hair reduction', 'Diode laser on a consultant-set protocol, priced by area.',
      'Sessions are spaced four to six weeks apart and settings are set by a clinician, not a default on the machine. Six to eight sessions is the usual course. Underlying hormonal drivers are investigated first, because treating PCOS-driven hirsutism with laser alone is a course of treatment that disappoints.',
      45, '6–8 sessions', 350000, 1200000, 'Per session by area · package and EMI available', 1, 1, sLaserSvc],
    [cLaser, 'pigment-laser', 'Pigment & vascular laser', 'Q-switched and long-pulsed treatment for pigment and vessels.',
      'Used for stable pigment, tattoos, and vascular lesions. Test patch first, always, and a documented interval before the full treatment.',
      40, '3–6 sessions', 400000, 1500000, 'Per session by area', 1, 0, null],
    [cLaser, 'tattoo-removal', 'Tattoo removal', 'Q-switched Nd:YAG across a realistic number of sessions.',
      'Ink colour, depth and age all change the number of sessions, and eight to twelve is common for anything larger than a coin. We photograph and quote by size at the consultation rather than over the telephone.',
      30, '8–12 sessions', 300000, 1000000, 'Per session by size · EMI available', 1, 0, null],

    [cHair, 'hair-loss', 'Hair loss assessment', 'Trichoscopy, bloods and a medical plan before anything else.',
      'A hair loss consultation starts with trichoscopy and a blood panel, because iron, thyroid and vitamin D account for a great deal of what walks through the door. Medical management is given a fair trial before any procedure is discussed.',
      40, 'Review at 3 months', 100000, null, 'Includes trichoscopy; bloods separate', 0, 1, sHair],
    [cHair, 'prp-hair', 'PRP for hair', 'Platelet-rich plasma as an adjunct, not a miracle.',
      'PRP works best as an adjunct to medical treatment in early to moderate androgenetic loss. Four sessions a month apart, then a review with standardised photographs before committing to more.',
      45, '4 sessions then review', 550000, null, 'Per session · package of 4 available', 1, 0, null],
    [cHair, 'hair-transplant', 'Hair transplant (FUE)', 'Follicular unit extraction, graft numbers quoted honestly.',
      'Suitability is decided by donor density and the pattern of loss, not by how much a patient wants it. Graft numbers are counted and quoted in writing. Where a patient is too young or still actively losing hair, we say wait — and we say why.',
      480, 'Single day procedure', 8500000, 22000000, 'By graft count · EMI over 6–24 months', 1, 1, null],

    [cAesthetic, 'chemical-peels', 'Chemical peels', 'Superficial and medium-depth peels within a plan.',
      'Peels are a tool inside a treatment plan, not a service to be bought by the sitting. Agent and depth are chosen at the consultation and adjusted as the skin responds.',
      30, '4–6 sessions', 250000, 600000, 'Per session by agent', 0, 0, null],
    [cAesthetic, 'botulinum', 'Botulinum toxin', 'Conservative dosing, reviewed at two weeks.',
      'Dosed conservatively at the first treatment with a review at two weeks, because it is straightforward to add and impossible to take away. Records kept of units and sites for every visit.',
      30, 'Every 4–6 months', 1200000, 2500000, 'By area and units', 0, 0, null],
    [cAesthetic, 'fillers', 'Dermal fillers', 'Assessed in person, and declined where it is not appropriate.',
      'Hyaluronic acid filler for volume and contour, with a documented consent conversation covering vascular risk. We decline more of these requests than we accept, and we will explain why in the room.',
      45, 'Every 9–18 months', 2200000, 4500000, 'Per syringe · EMI available', 1, 0, null],
  ];

  SERVICES.forEach((s, i) => {
    const [category, slug, name, summary, body, duration, sessions, from, to, note, emi, featured, mediaId] = s;
    run(
      `INSERT INTO services
         (category_id, slug, name, summary, body, duration_min, sessions_typical,
          price_from_paise, price_to_paise, price_note, is_emi_eligible,
          is_featured, media_id, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      category, slug, name, summary, body, duration, sessions, from, to, note, emi, featured, mediaId, i
    );
  });

  /* ---- doctors ----------------------------------------------------------- */

  const DOCTORS = [
    ['Dr Aditi Deshmukh', 'MBBS, MD (Dermatology, Venereology & Leprosy)', 'Consultant Dermatologist & Clinical Director',
      'MMC 2011/04/1187', 14, 'English, Hindi, Marathi',
      'Founded TWACHA in 2017 after seven years in hospital dermatology at Sassoon and a fellowship in dermatologic surgery. Her clinical interest is inflammatory skin disease and acne scarring, and she still runs the Monday morning general list herself. She teaches on the DNB dermatology programme and has an uncommonly low tolerance for treatments sold without evidence.',
      mDrAditi],
    ['Dr Kabir Menon', 'MBBS, DDVL', 'Consultant Dermatologist — Hair & Scalp',
      'MMC 2015/09/3340', 10, 'English, Hindi, Malayalam',
      'Leads the hair and scalp service across both clinics. Trained in trichoscopy in Chennai and completed a fellowship in hair restoration surgery in 2021. He is candid with patients about what medical management can achieve before surgery is worth discussing, which is why the transplant list here is shorter than most.',
      mDrKabir],
    ['Dr Meera Iyer', 'MBBS, MD (Dermatology)', 'Consultant Dermatologist — Paediatric',
      'MMC 2017/02/5178', 8, 'English, Hindi, Tamil, Marathi',
      'Runs the Thursday paediatric list at Koregaon Park. Her interest is atopic eczema in children and the vanishingly small role topical steroids need to play when a maintenance routine is set up properly. Parents tend to leave her clinic with fewer prescriptions than they expected.',
      mDrMeera],
  ];

  DOCTORS.forEach((d, i) => run(
    `INSERT INTO doctors (name, credentials, role_title, registration_no,
       experience_years, languages, bio, media_id, sort_order)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    ...d, i
  ));

  /* ---- locations --------------------------------------------------------- */

  const locKP = Number(run(
    `INSERT INTO locations (name, address_line1, address_line2, city, state, pincode,
       phone, whatsapp, google_maps_url, hours, is_primary, sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,1,0)`,
    'TWACHA Koregaon Park',
    'Unit 3, Ground Floor, Sunderban Corner',
    'Lane 7, Koregaon Park',
    'Pune', 'Maharashtra', '411001',
    '+91 20 4120 8800', '+919822041208',
    'https://www.google.com/maps/search/?api=1&query=dermatologist+Koregaon+Park+Pune',
    'Mon–Fri 10:00–19:30\nSat 10:00–17:00\nSun closed'
  ).lastInsertRowid);

  const locBaner = Number(run(
    `INSERT INTO locations (name, address_line1, address_line2, city, state, pincode,
       phone, whatsapp, google_maps_url, hours, is_primary, sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,0,1)`,
    'TWACHA Baner',
    '201, Sai Capital, Baner Road',
    'Opposite Baner Telephone Exchange',
    'Pune', 'Maharashtra', '411045',
    '+91 20 4120 8811', '+919822041208',
    'https://www.google.com/maps/search/?api=1&query=dermatologist+Baner+Pune',
    'Mon–Sat 11:00–20:00\nSun closed'
  ).lastInsertRowid);

  /* ---- testimonials -----------------------------------------------------
     Marked 'google-seed' so both the site and the admin panel can state
     plainly that these are placeholders standing in for the live Places feed.
     -------------------------------------------------------------------- */

  const REVIEWS = [
    ['Sanket Pawar', 5, 'I had been through three clinics for acne before this one. Dr Deshmukh was the first to actually grade it, explain why the earlier treatment had not worked, and give me a timeline. Twelve weeks in and it is genuinely under control. The price she quoted at the start is the price I paid.', 'Active acne', locKP, '2026-07-18'],
    ['Priyanka Joshi', 5, 'Went in expecting to be upsold a laser package for melasma and instead got a long explanation of why we were going to spend three months on sunscreen and a cream first. It worked. I appreciate a clinic that talks me out of spending money.', 'Pigmentation & melasma', locKP, '2026-07-02'],
    ['Rahul Deshpande', 4, 'Good clinic, honest doctor. Dr Menon told me straight that a transplant was not sensible at my age and that I should try medical treatment for a year first. Only reason for four stars is that the Baner clinic runs late in the evenings.', 'Hair loss assessment', locBaner, '2026-06-24'],
    ['Fatima Shaikh', 5, 'My daughter has had eczema since she was two and Dr Iyer is the first dermatologist who explained the maintenance routine properly instead of just handing over a steroid tube. Written instructions, which helped enormously. Six months and no flare.', 'Paediatric dermatology', locKP, '2026-06-11'],
    ['Aniket Kulkarni', 5, 'Had a mole removed. Dermoscopy first, procedure the following week, histology back in five days and they called me with the result rather than making me chase it. Clean, professional, no drama.', 'Mole & lesion removal', locKP, '2026-05-29'],
    ['Sneha Rane', 5, 'Six sessions of laser hair reduction on the no-cost EMI. The EMI was exactly as described, nothing hidden, and the front desk sent me a payment reminder every month. Results are about what they said to expect, which is refreshing.', 'Laser hair reduction', locBaner, '2026-05-14'],
    ['Vikram Chatterjee', 4, 'Thorough consultation for psoriasis and a proper long-term plan rather than a quick fix. Waiting time was around twenty minutes past my slot, but the consultation itself was not rushed at all, so I will not complain.', 'Eczema & psoriasis', locKP, '2026-04-30'],
    ['Meghana Rao', 5, 'The acne scar programme was expensive and they were upfront about that from the first visit, including showing me the before photos of other patients so I could judge for myself. Four sessions done, noticeable difference. Photographs at every visit.', 'Acne scar programme', locKP, '2026-04-08'],
  ];

  REVIEWS.forEach((r, i) => {
    const [author, rating, body, treatment, locationId, reviewedAt] = r;
    run(
      `INSERT INTO testimonials (author, rating, body, treatment, source, location_id,
         reviewed_at, sort_order)
       VALUES (?,?,?,?,'google-seed',?,?,?)`,
      author, rating, body, treatment, locationId, reviewedAt, i
    );
  });

  /* ---- enquiries --------------------------------------------------------- */

  const svc = (slug) => get('SELECT id FROM services WHERE slug = ?', slug)?.id ?? null;
  const ago = (days) => {
    const d = new Date(Date.now() - days * 86400_000);
    return d.toISOString().slice(0, 19).replace('T', ' ');
  };

  const ENQUIRIES = [
    ['Nikhil Bhagat', '+91 98901 22345', 'nikhil.bhagat@example.in', 'acne-active', locKP,
      'Acne on my jawline and back for about eight months. Have tried two over-the-counter creams with no real change. Would prefer a Saturday appointment if possible.',
      'Saturday morning', 0, 1, 'new', 'high', 0],
    ['Aarti Nene', '+91 99229 88110', 'aarti.nene@example.in', 'laser-hair-reduction', locBaner,
      'Interested in laser hair reduction for full legs and underarms. Please share package pricing and whether the no-cost EMI applies.',
      'Weekday evening', 1, 1, 'new', 'normal', 1],
    ['Suresh Iyer', '+91 90280 41197', null, 'hair-transplant', locKP,
      'Male pattern baldness, mid-thirties. Want to understand graft numbers and total cost before committing to a consultation.',
      'Any', 1, 1, 'contacted', 'high', 2],
    ['Kavita Mehta', '+91 98220 73344', 'kavita.m@example.in', 'pigmentation-melasma', locKP,
      'Melasma across both cheeks, worse since my second pregnancy. Previously treated elsewhere with a peel course which made it darker.',
      'Weekday morning', 0, 1, 'booked', 'normal', 4],
    ['Imran Qureshi', '+91 70301 55678', 'imran.q@example.in', 'scar-revision', locBaner,
      'Acne scarring, mostly rolling scars on the cheeks. Acne itself settled about two years ago. Asking about the staged programme and EMI.',
      'Saturday', 1, 1, 'contacted', 'normal', 5],
    ['Deepa Sundaram', '+91 89765 43210', null, 'paediatric', locKP,
      'My son is four and has had eczema behind the knees for over a year. Looking for Dr Iyer specifically, was recommended by a colleague.',
      'Thursday morning', 0, 1, 'booked', 'normal', 7],
    ['Rajesh Kadam', '+91 98505 11223', 'rkadam@example.in', 'mole-check', locKP,
      'Family history of skin cancer. Would like a full mole check and mapping.',
      'Any weekday', 0, 1, 'completed', 'normal', 12],
    ['Anonymous', '+91 00000 00000', null, null, null,
      'BUY CHEAP FOLLOWERS VISIT OUR SITE NOW BEST PRICE GUARANTEED',
      null, 0, 1, 'spam', 'low', 3],
    ['Pooja Wagh', '+91 91560 77889', 'pooja.wagh@example.in', 'botulinum', locBaner,
      'Enquiring about botulinum for forehead lines. First time, so would like to discuss what is realistic.',
      'Weekday evening', 0, 1, 'closed', 'low', 15],
  ];

  const enquiryIds = ENQUIRIES.map((e) => {
    const [name, phone, email, slug, locId, message, pref, emi, consent, status, priority, days] = e;
    const r = run(
      `INSERT INTO enquiries (name, phone, email, service_id, location_id, message,
         preferred_time, wants_emi, consent, status, priority, source, assigned_to,
         created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'website',?,?,?)`,
      name, phone, email, slug ? svc(slug) : null, locId, message, pref, emi, consent,
      status, priority, status === 'new' ? null : frontDeskId, ago(days), ago(Math.max(0, days - 1))
    );
    return Number(r.lastInsertRowid);
  });

  const NOTES = [
    [2, 'Called and left voicemail. Will try again tomorrow morning.'],
    [2, 'Spoke to patient. Sent graft-count explainer on WhatsApp. Wants to discuss EMI over 12 months — flagged for Dr Menon.'],
    [3, 'Booked for Tuesday 10:30 with Dr Deshmukh. Warned about the previous peel history.'],
    [4, 'Explained the staged scar programme and shared indicative pricing. Wants to think about it.'],
    [5, 'Booked Thursday paediatric list with Dr Iyer.'],
    [6, 'Mole check completed. Two lesions photographed for mapping, no biopsy needed. Annual recall set.'],
  ];
  for (const [idx, note] of NOTES) {
    run(
      'INSERT INTO enquiry_notes (enquiry_id, user_id, note, created_at) VALUES (?,?,?,?)',
      enquiryIds[idx], frontDeskId, note, ago(1)
    );
  }

  /* ---- patients, plans, instalments, payments ---------------------------- */

  /**
   * `daysAgo` backdates the record. Without it every patient reads "on record
   * since today" while holding a plan that started five months ago, which makes
   * the demo data read as obviously fake.
   */
  const patient = (daysAgo, name, phone, email, city, notes) => {
    const id = Number(run(
      `INSERT INTO patients (name, phone, email, city, notes, created_at)
       VALUES (?,?,?,?,?,?)`,
      name, phone, email, city, notes, ago(daysAgo)
    ).lastInsertRowid);
    run('UPDATE patients SET ref = ? WHERE id = ?', makeRef('PT-', id), id);
    return id;
  };

  // Each is registered a few weeks before their plan starts, oldest first.
  const pSneha = patient(198, 'Sneha Rane', '+91 98901 44556', 'sneha.rane@example.in', 'Pune', 'Laser hair reduction, completed course.');
  const pKavita = patient(166, 'Kavita Mehta', '+91 98220 73344', 'kavita.m@example.in', 'Pune', 'Melasma. Prior peel course elsewhere caused rebound — avoid aggressive agents.');
  const pSuresh = patient(134, 'Suresh Iyer', '+91 90280 41197', null, 'Pune', 'FUE transplant, 2,400 grafts. Extended tenure.');
  const pImran = patient(103, 'Imran Qureshi', '+91 70301 55678', 'imran.q@example.in', 'Pune', 'Rolling acne scars, staged programme.');
  const pMeghana = patient(71, 'Meghana Rao', '+91 99873 20014', 'meghana.rao@example.in', 'Pune', 'Scar programme, four of six sessions done.');
  patient(9, 'Rajesh Kadam', '+91 98505 11223', 'rkadam@example.in', 'Pune', 'Annual mole check and mapping. No plan.');

  run('UPDATE enquiries SET patient_id = ? WHERE id = ?', pKavita, enquiryIds[3]);
  run('UPDATE enquiries SET patient_id = ? WHERE id = ?', pImran, enquiryIds[4]);

  /**
   * Create a plan with its schedule, then apply the given payments so the
   * demo data lands in genuinely different states: on track, overdue,
   * completed, part-paid.
   */
  const makePlan = (o) => {
    const schedule = buildSchedule({
      principalPaise: o.principal,
      downpaymentPaise: o.downpayment ?? 0,
      tenureMonths: o.tenure,
      rateBps: o.rateBps ?? 0,
      processingFeePaise: o.fee ?? 0,
      startDate: o.startDate,
    });

    const planId = Number(run(
      `INSERT INTO emi_plans (patient_id, service_id, title, principal_paise,
         downpayment_paise, financed_paise, tenure_months, interest_rate_bps,
         processing_fee_paise, installment_paise, total_payable_paise,
         start_date, notes, created_by, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?)`,
      o.patientId, o.serviceId ?? null, o.title, o.principal, o.downpayment ?? 0,
      schedule.financed_paise, o.tenure, o.rateBps ?? 0, o.fee ?? 0,
      schedule.installment_paise, schedule.total_payable_paise,
      o.startDate, o.notes ?? null, ownerId,
      // A plan is agreed a few days before its first instalment falls due;
      // stamping it "raised today" contradicts a schedule that began in April.
      `${o.startDate} 11:20:00`, `${o.startDate} 11:20:00`
    ).lastInsertRowid);
    run('UPDATE emi_plans SET ref = ? WHERE id = ?', makeRef('EMI-', planId), planId);

    const instIds = schedule.rows.map((row) => Number(run(
      'INSERT INTO installments (plan_id, seq, due_date, amount_paise) VALUES (?,?,?,?)',
      planId, row.seq, row.due_date, row.amount_paise
    ).lastInsertRowid));

    const receipt = (amount, kind, method, on, instId = null, note = null) => {
      const id = Number(run(
        `INSERT INTO payments (patient_id, plan_id, installment_id, amount_paise, kind,
           method, received_on, received_by, notes)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        o.patientId, planId, instId, amount, kind, method, on, frontDeskId, note
      ).lastInsertRowid);
      run('UPDATE payments SET receipt_no = ? WHERE id = ?', makeRef('RC-', id, 5), id);
    };

    if ((o.downpayment ?? 0) > 0) {
      receipt(o.downpayment, 'downpayment', 'card', o.startDate, null, 'Down payment at booking.');
    }

    // Settle the first `paidCount` instalments in full.
    for (let i = 0; i < (o.paidCount ?? 0); i++) {
      const row = schedule.rows[i];
      run(
        `UPDATE installments SET paid_paise = ?, status = 'paid', paid_on = ? WHERE id = ?`,
        row.amount_paise, row.due_date, instIds[i]
      );
      receipt(row.amount_paise, 'installment', o.method ?? 'upi', row.due_date, instIds[i]);
    }

    // Optionally leave one instalment part-paid, which is the awkward case
    // every real ledger contains and most demos leave out.
    if (o.partial) {
      const i = o.paidCount ?? 0;
      const row = schedule.rows[i];
      run(
        `UPDATE installments SET paid_paise = ?, status = 'partial' WHERE id = ?`,
        o.partial, instIds[i]
      );
      receipt(o.partial, 'installment', 'cash', row.due_date, instIds[i], 'Part payment; balance promised next week.');
    }

    const open = get(
      `SELECT COUNT(*) AS n FROM installments WHERE plan_id = ? AND status IN ('due','partial')`,
      planId
    ).n;
    if (open === 0) run(`UPDATE emi_plans SET status = 'completed' WHERE id = ?`, planId);

    return planId;
  };

  const day = today();
  const monthsBack = (n) => addMonths(`${day.slice(0, 8)}05`, -n);

  // On track: six-month no-cost, three paid.
  makePlan({
    patientId: pImran, serviceId: svc('scar-revision'),
    title: 'Acne scar programme — 6 sessions',
    principal: 1_150_000, downpayment: 250_000, tenure: 6, startDate: monthsBack(3),
    paidCount: 3, notes: 'No-cost EMI. Sessions booked at six-week intervals.',
  });

  // Overdue: two instalments missed.
  makePlan({
    patientId: pKavita, serviceId: svc('pigmentation-melasma'),
    title: 'Melasma management — 9 month course',
    principal: 780_000, downpayment: 100_000, tenure: 9, startDate: monthsBack(5),
    paidCount: 3, method: 'netbanking',
    notes: 'Patient travelling; reception to follow up on the two missed months.',
  });

  // Completed.
  makePlan({
    patientId: pSneha, serviceId: svc('laser-hair-reduction'),
    title: 'Laser hair reduction — full legs & underarms, 8 sessions',
    principal: 960_000, downpayment: 160_000, tenure: 4, startDate: monthsBack(6),
    paidCount: 4, notes: 'Course finished. Maintenance discussed at final review.',
  });

  // Interest-bearing, long tenure, one part-paid instalment.
  makePlan({
    patientId: pSuresh, serviceId: svc('hair-transplant'),
    title: 'FUE hair transplant — 2,400 grafts',
    principal: 14_400_000, downpayment: 2_400_000, tenure: 18, rateBps: 1200,
    fee: 120_000, startDate: monthsBack(4), paidCount: 3, partial: 300_000,
    notes: 'Extended tenure at 12% p.a. Processing fee collected upfront. Terms given in writing 04/xx.',
  });

  // Part-paid, no downpayment.
  makePlan({
    patientId: pMeghana, serviceId: svc('scar-revision'),
    title: 'Acne scar programme — 6 sessions',
    principal: 1_320_000, tenure: 6, startDate: monthsBack(2),
    paidCount: 2, partial: 100_000,
    notes: 'No down payment agreed. Four of six sessions completed.',
  });

  /* One-off receipts unrelated to any plan, so the ledger is not made up
     entirely of instalments. */
  const oneOff = (patientId, amount, kind, method, on, notes) => {
    const id = Number(run(
      `INSERT INTO payments (patient_id, amount_paise, kind, method, received_on, received_by, notes)
       VALUES (?,?,?,?,?,?,?)`,
      patientId, amount, kind, method, on, frontDeskId, notes
    ).lastInsertRowid);
    run('UPDATE payments SET receipt_no = ? WHERE id = ?', makeRef('RC-', id, 5), id);
  };

  oneOff(pKavita, 80_000, 'consultation', 'upi', day, 'Follow-up consultation.');
  oneOff(pMeghana, 80_000, 'consultation', 'cash', monthsBack(2), 'First consultation.');
  oneOff(pSneha, 180_000, 'procedure', 'card', monthsBack(1), 'Single maintenance laser session.');

  run(
    `INSERT INTO activity_log (user_id, action, entity, detail, ip)
     VALUES (?, 'seed', 'database', ?, 'local')`,
    ownerId, JSON.stringify({ note: 'Demonstration data seeded.' })
  );
});

/* -------------------------------------------------------------------------- */

const count = (t) => get(`SELECT COUNT(*) AS n FROM ${t}`).n;

console.log(`
  Seeded TWACHA demonstration data
  ────────────────────────────────────────────────────────────
  sections ${count('sections')}   items ${count('section_items')}   services ${count('services')}   doctors ${count('doctors')}
  locations ${count('locations')}   reviews ${count('testimonials')}   media ${count('media')}   settings ${count('settings')}
  enquiries ${count('enquiries')}   patients ${count('patients')}   plans ${count('emi_plans')}
  instalments ${count('installments')}   payments ${count('payments')}

  Sign in at /admin/
  ────────────────────────────────────────────────────────────
  Owner     ${OWNER_EMAIL}  /  ${OWNER_PASSWORD}
  Manager   manager@twacha.in  /  ClinicManager2026
  Reception reception@twacha.in  /  FrontDesk2026

  Change these before the site is reachable by anybody else.
`);
