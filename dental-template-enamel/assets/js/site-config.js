/* =========================================================
   ENAMEL — per-client configuration
   ---------------------------------------------------------
   This is the ONLY file you edit per customer. Everything
   here overrides the demo content baked into index.html.

   Leave a value as an empty string ('') to keep whatever the
   template already ships with. Set a section's `enabled` flag
   to false to remove that section from the page entirely.

   The field names below match the column names in
   dental-site-builder/clients.csv one-for-one.
   ========================================================= */
window.SITE_CONFIG = {

  /* ---------- 1. Page meta ---------- */
  meta: {
    title:       'ENAMEL — dental studio, Sheffield',
    description: 'A dental studio in Sheffield. Fixed prices, same-day emergencies, and nobody whispering about your teeth over your head.',
    themeColor:  '#FF4A17'
  },

  /* ---------- 2. Business identity ---------- */
  business: {
    name:      'ENAMEL',          /* header logo + footer wordmark */
    tagline:   'dental studio',
    legalName: 'ENAMEL Dental Studio Ltd',
    city:      'Sheffield',
    openNote:  'Open Saturdays'   /* small pill above the headline */
  },

  /* ---------- 3. Brand colour ---------- */
  /* One accent colour drives the whole page. */
  brand: {
    primary: '#FF4A17',
    ink:     '#111110'
  },

  /* ---------- 4. Contact ---------- */
  contact: {
    phoneDisplay: '0114 496 0180',
    phoneHref:    '+441144960180',   /* digits only, no spaces */
    email:        'hello@enamel.example',
    whatsapp:     ''                 /* digits only; blank hides the button */
  },

  /* ---------- 5. Location + Google Maps ---------- */
  location: {
    line1:    'Unit 4, Vulcan Works',
    line2:    'Sheffield S1 4RG',

    /* Pick ONE of the three map options below.
       1. mapQuery   — simplest. Just the address or business name.
       2. mapEmbedUrl— paste the src="..." from Google Maps > Share > Embed a map.
       3. mapLat/Lng — exact pin when the address is ambiguous. */
    mapQuery:    'Vulcan Works, Sheffield S1 4RG',
    mapEmbedUrl: '',
    mapLat:      '',
    mapLng:      '',
    mapZoom:     16,

    /* Optional. Left blank, both are generated from the address. */
    directionsUrl: '',
    reviewsUrl:    '',

    parkingNote: 'Two hours free on Mowbray Street, and the tram stops outside.'
  },

  /* ---------- 6. Opening hours ---------- */
  hours: [
    { days: 'Mon–Thu', time: '08:00 — 19:00' },
    { days: 'Fri',     time: '08:00 — 17:00' },
    { days: 'Sat',     time: '09:00 — 14:00' },
    { days: 'Sun',     time: 'Closed' }
  ],

  /* ---------- 6b. "Open now" badge ---------- */
  /* Strict "HH:MM-HH:MM" (24h). An empty string means closed that
     day. Unused by this template, but kept so one CSV row can
     build either design without losing data. */
  openBadge: {
    weekdays:   '08:00-19:00',
    saturday:   '09:00-14:00',
    sunday:     '',
    closedNote: 'Closed · ring for emergencies'
  },

  /* ---------- 7. Consultation / booking block ---------- */
  consult: {
    eyebrow:  'Book a consultation',
    heading:  'Pick a day. Pick a time.',
    blurb:    'Live availability for the next fortnight. Anything greyed out has gone. If you are in pain, ring instead and we will find you a slot today.',
    firstVisitPrice: '£65',
    firstVisitNote:  'First visit, 45 minutes',
    responseNote:    'Confirmed by text within the hour',
    ctaLabel:        'Confirm the booking'
  },

  /* ---------- 8. Headline stats ---------- */
  stats: [
    { value: '11',    label: 'Surgeries' },
    { value: '7,400', label: 'Patients' },
    { value: '4.9',   label: 'Out of five' },
    { value: '0',     label: 'Hidden charges' }
  ],

  /* ---------- 9. Clinicians ---------- */
  /* Photos: a URL, or a local path like 'assets/img/dr-smith.jpg'.
     Delete entries you do not need — the row shrinks to fit. */
  team: {
    enabled: true,
    heading: 'Eighteen of us.<br />Four who see you first.',
    note:    'You get the same clinician every visit unless you ask to change. Their names are on your notes, not a rota.',
    members: [
      {
        name:  'Dr. Theo Bakare',
        role:  'Clinical lead',
        bio:   'Restorative work and the long rebuilds. Talks fast, explains twice.',
        image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80'
      },
      {
        name:  'Dr. Amara Osei',
        role:  'Dentist / Aligners',
        bio:   'Plans every aligner case herself and shows you the scan on day one.',
        image: 'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?auto=format&fit=crop&w=600&q=80'
      },
      {
        name:  'Mr. Devan Rao',
        role:  'Oral surgery',
        bio:   'Wisdom teeth and implants. Fifteen years on a hospital list first.',
        image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=600&q=80'
      },
      {
        name:  'Marisa Ferreira',
        role:  'Lead hygienist',
        bio:   'Runs the gum programme. Will fix your brushing in four minutes flat.',
        image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=600&q=80'
      }
    ]
  },

  /* ---------- 10. Practice photos ---------- */
  /* Straight from the client's Google Business Profile, or their own
     photos. Set enabled:false (or leave images empty) to drop the
     whole section — useful when a prospect has no photos worth using. */
  gallery: {
    enabled: true,
    heading: 'The studio, not a stock photo.',
    note:    'Every picture below was taken in the building. Reception, the surgeries, the bit where you actually sit.',
    images: [
      { src: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=900&q=80', alt: 'Reception at the studio' },
      { src: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=900&q=80', alt: 'Imaging screen in a surgery' },
      { src: 'https://images.unsplash.com/photo-1629909615184-74f495363b67?auto=format&fit=crop&w=900&q=80', alt: 'A treatment room with natural light' },
      { src: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=900&q=80', alt: 'A dentist talking a patient through a plan' },
      { src: 'https://images.unsplash.com/photo-1616391182219-e080b4d1043a?auto=format&fit=crop&w=900&q=80', alt: 'Chairside monitor showing a scan' },
      { src: 'https://images.unsplash.com/photo-1581056771107-24ca5f033842?auto=format&fit=crop&w=900&q=80', alt: 'A clinician reassuring a patient' }
    ]
  },

  /* ---------- 11. Google rating strip ---------- */
  reviewsMeta: {
    rating:  '4.9',
    count:   '812',
    heading: '4.9 from 812 people.'
  },

  /* ---------- 12. Sticky mobile bar ---------- */
  dock: {
    label: 'Check-up',
    price: '£65',
    cta:   'Book a visit'
  }
};
