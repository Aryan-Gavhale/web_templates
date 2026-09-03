/* =========================================================
   Aurelia — per-client configuration
   ---------------------------------------------------------
   This is the ONLY file you edit per customer. Everything
   here overrides the demo content baked into index.html.

   Leave a value as an empty string ('') to keep whatever the
   template already ships with. Set a section's `enabled` flag
   to false to remove that section from the page entirely.

   The field names below match the column names in
   dental-site-builder/clients.csv one-for-one, and are
   identical to the ENAMEL template's config — so one CSV row
   can build either design.
   ========================================================= */
window.SITE_CONFIG = {

  /* ---------- 1. Page meta ---------- */
  meta: {
    title:       'Aurelia — Dental Institute & Multi-speciality Hospital',
    description: 'Aurelia Dental Institute — a multi-speciality dental hospital. Guided implantology, digital orthodontics, same-day restorations and 24/7 emergency care.',
    themeColor:  '#101E1A'
  },

  /* ---------- 2. Business identity ---------- */
  business: {
    name:      'Aurelia',
    tagline:   'Dental Institute',
    legalName: 'Aurelia Dental Institute',
    city:      'Harbour Quarter',
    openNote:  'Est. 1998 · Multi-speciality dental hospital'
  },

  /* ---------- 3. Brand colour ---------- */
  brand: {
    primary: '#1D4A3D',   /* moss — headings, sweeps, accents */
    ink:     '#101E1A'
  },

  /* ---------- 4. Contact ---------- */
  contact: {
    phoneDisplay: '+1 800 555 0142',
    phoneHref:    '+18005550142',   /* digits only, no spaces */
    email:        'reception@aurelia.example',
    whatsapp:     ''                /* digits only; blank hides the button */
  },

  /* ---------- 5. Location + Google Maps ---------- */
  location: {
    line1:    '18 Whitmore Street',
    line2:    'Harbour Quarter, EC2 4RN',

    /* Pick ONE of the three map options below.
       1. mapQuery   — simplest. Just the address or business name.
       2. mapEmbedUrl— paste the src="..." from Google Maps > Share > Embed a map.
       3. mapLat/Lng — exact pin when the address is ambiguous. */
    mapQuery:    '18 Whitmore Street, London EC2 4RN',
    mapEmbedUrl: '',
    mapLat:      '',
    mapLng:      '',
    mapZoom:     16,

    /* Optional. Left blank, both are generated from the address. */
    directionsUrl: '',
    reviewsUrl:    '',

    parkingNote: 'Floor G to 4. Patient parking on level B1, lift to reception.'
  },

  /* ---------- 6. Opening hours ---------- */
  hours: [
    { days: 'Mon – Fri', time: '08:00 – 20:00' },
    { days: 'Saturday',  time: '09:00 – 17:00' },
    { days: 'Sunday',    time: 'Closed' },
    { days: 'Emergency', time: '24 hours' }
  ],

  /* ---------- 6b. "Open now" badge in the header ---------- */
  /* Strict "HH:MM-HH:MM" (24h). An empty string means closed
     that day. This is separate from the hours list above because
     it has to be machine-readable, not pretty. */
  openBadge: {
    weekdays:   '08:00-20:00',
    saturday:   '09:00-17:00',
    sunday:     '',
    closedNote: 'Closed · emergency line open'
  },

  /* ---------- 7. Consultation / booking block ---------- */
  consult: {
    /* This template numbers its sections, so keep the prefix. */
    eyebrow:  '03 — Consultation',
    heading:  'A coordinator calls you back within four working hours.',
    blurb:    'Tell us when suits and which department you think you need. If you are not sure, leave it — the coordinator will place you correctly before anyone books a room.',
    firstVisitPrice: '90 min',
    firstVisitNote:  'First consultation length',
    responseNote:    'Called back within 4 working hours',
    ctaLabel:        'Request appointment'
  },

  /* ---------- 8. Headline stats ---------- */
  stats: [
    { value: '28',  label: 'Years of care' },
    { value: '42',  label: 'Specialists' },
    { value: '4.9', label: 'Patient rating' }
  ],

  /* ---------- 9. Clinicians ---------- */
  /* Photos: a URL, or a local path like 'assets/img/dr-smith.jpg'.
     Delete entries you do not need — the row shrinks to fit. */
  team: {
    enabled: true,
    heading: 'The clinician who plans it <em>performs</em> it.',
    note:    '',
    members: [
      {
        name:  'Dr. Elin Marchetti',
        role:  'Clinical Director · Implantology',
        bio:   'MDS, FICOI · 4,100 fixtures placed',
        image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=700&q=80'
      },
      {
        name:  'Dr. Rahul Iyer',
        role:  'Head of Maxillofacial Surgery',
        bio:   'MDS, MFDS RCS · Orthognathic lead',
        image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=700&q=80'
      },
      {
        name:  'Dr. Naomi Okafor',
        role:  'Orthodontics & Dentofacial',
        bio:   'MOrth RCS · 2,600 aligner cases',
        image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=700&q=80'
      },
      {
        name:  'Dr. Marcus Adeyemi',
        role:  'Endodontics · Microsurgery',
        bio:   'MSc Endo · 25× magnification only',
        image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=700&q=80'
      }
    ]
  },

  /* ---------- 10. Practice photos ---------- */
  /* Straight from the client's Google Business Profile, or their own
     photos. Set enabled:false (or leave images empty) to drop the
     whole section — useful when a prospect has no photos worth using. */
  gallery: {
    enabled: true,
    heading: 'The building, <em>photographed</em> as it stands.',
    note:    'Four floors, eleven speciality suites. No renders, no stock library — these are the rooms you will actually be treated in.',
    images: [
      { src: 'https://images.unsplash.com/photo-1629909615184-74f495363b67?auto=format&fit=crop&w=900&q=80', alt: 'Consultation room with natural light' },
      { src: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=900&q=80', alt: 'Radiographs on a viewing screen' },
      { src: 'https://images.unsplash.com/photo-1616391182219-e080b4d1043a?auto=format&fit=crop&w=900&q=80', alt: 'Treatment suite with a chairside monitor' },
      { src: 'https://images.unsplash.com/photo-1571772996211-2f02c9727629?auto=format&fit=crop&w=900&q=80', alt: 'Surgical team in theatre' },
      { src: 'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&w=900&q=80', alt: 'A clear aligner being fitted' },
      { src: 'https://images.unsplash.com/photo-1581056771107-24ca5f033842?auto=format&fit=crop&w=900&q=80', alt: 'A clinician reassuring a patient' }
    ]
  },

  /* ---------- 11. Google rating strip ---------- */
  reviewsMeta: {
    rating:  '4.9',
    count:   '1,240',
    heading: ''
  },

  /* ---------- 12. Sticky mobile bar ---------- */
  dock: {
    label: 'Consultation',
    price: '90 min',
    cta:   'Book a visit'
  }
};
