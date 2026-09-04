/* =========================================================
   AROGYA — per-client configuration
   ---------------------------------------------------------
   Built for Indian dental practices. Same field names as the
   other templates in the pack, so one row of clients.csv can
   build any of them, plus a `services` block for the price
   list that Indian patients expect to see up front.

   Leave a value as an empty string ('') to keep whatever the
   template already ships with. Set a section's `enabled` flag
   to false to remove that section from the page entirely.
   ========================================================= */
window.SITE_CONFIG = {

  /* ---------- 1. Page meta ---------- */
  meta: {
    title:       'Arogya Dental Studio — Dental Clinic in Pune',
    description: 'A dental studio in Pune. Transparent pricing, painless root canals, same-day crowns and no-cost EMI. Open seven days.',
    themeColor:  '#0E7C66'
  },

  /* ---------- 2. Business identity ---------- */
  business: {
    name:      'Arogya Dental',
    tagline:   'dental studio',
    legalName: 'Arogya Dental Studio',
    city:      'Pune',
    openNote:  'Open all 7 days',     /* chip beside the city in the hero */

    /* Shown beside the headline on desktop only, so pick the best
       single photo of the place. Blank removes it and the headline
       simply runs wider. */
    heroImage: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80'
  },

  /* ---------- 3. Brand colour ---------- */
  /* One accent drives the whole page — buttons, chips, the
     bottom bar and the Android address bar. */
  brand: {
    primary: '#0E7C66',
    ink:     '#0A1310'
  },

  /* ---------- 4. Contact ---------- */
  contact: {
    phoneDisplay: '098220 14700',
    phoneHref:    '+919822014700',   /* digits only, with country code */
    email:        'care@arogyadental.example',
    whatsapp:     '919822014700'     /* digits only; blank hides WhatsApp */
  },

  /* ---------- 5. Location + Google Maps ---------- */
  location: {
    line1:    'Shop 3, Ganga Trueno',
    line2:    'Baner Road, Baner, Pune 411045',

    /* Pick ONE. mapEmbedUrl is the most precise: on Google Maps,
       Share > Embed a map, then copy just the src="..." value. */
    mapQuery:    'Ganga Trueno, Baner Road, Baner, Pune 411045',
    mapEmbedUrl: '',
    mapLat:      '',
    mapLng:      '',
    mapZoom:     16,

    /* Optional. Left blank, both are generated from the address. */
    directionsUrl: '',
    reviewsUrl:    '',

    parkingNote: 'Parking in the basement. Lift to the third floor, we are straight ahead.'
  },

  /* ---------- 6. Opening hours ---------- */
  hours: [
    { days: 'Mon - Fri', time: '9:30 am - 8:30 pm' },
    { days: 'Saturday',  time: '9:30 am - 7:00 pm' },
    { days: 'Sunday',    time: '10:00 am - 2:00 pm' },
    { days: 'Emergency', time: 'On call, 24 hours' }
  ],

  /* ---------- 6b. "Open now" badge ---------- */
  /* Strict "HH:MM-HH:MM" on a 24-hour clock. An empty string
     means closed that day. This one feeds the live status pill,
     so it has to be machine-readable — the table above is only
     ever printed. */
  openBadge: {
    weekdays:   '09:30-20:30',
    saturday:   '09:30-19:00',
    sunday:     '10:00-14:00',
    /* Deliberately says nothing more than the truth. Only promise an
       emergency line here if the clinic actually answers one. */
    closedNote: 'Closed right now'
  },

  /* ---------- 7. Consultation / booking block ---------- */
  consult: {
    eyebrow:  'Book an appointment',
    heading:  'Tell us when suits you.',
    blurb:    'Send the form and the front desk calls you back to confirm the slot. If you are in pain today, ring instead and we will fit you in.',
    firstVisitPrice: '₹300',
    firstVisitNote:  'Consultation, 20 minutes',
    responseNote:    'Callback within the hour',
    ctaLabel:        'Request appointment'
  },

  /* ---------- 8. Headline numbers ---------- */
  stats: [
    { value: '14',     label: 'Years in Baner' },
    { value: '11,000', label: 'Patients treated' },
    { value: '4.9',    label: 'Google rating' },
    { value: '0',      label: 'Hidden charges' }
  ],

  /* ---------- 9. Treatments and prices ---------- */
  /* Indian patients compare on price before they call, so the
     list is on the page rather than behind an enquiry form.
     `category` drives the filter chips above the rail — reuse
     the same few words and the chips build themselves. */
  services: {
    enabled: true,
    heading: 'What it costs,<br />before you walk in.',
    note:    'Starting prices for the treatments we are asked about most. You get the final figure in writing after the check-up, and it does not move afterwards.',
    footnote: 'No-cost EMI available on treatments above ₹10,000. Cashless on most insurance panels.',
    items: [
      { name: 'Consultation & X-ray',  price: '₹300',    note: 'Waived if you start treatment the same day', category: 'General',  duration: '20 min' },
      { name: 'Scaling & polishing',   price: '₹1,200',  note: 'Ultrasonic clean, both arches',              category: 'General',  duration: '40 min' },
      { name: 'Tooth-coloured filling', price: '₹900',   note: 'Composite, single surface',                  category: 'General',  duration: '30 min' },
      { name: 'Root canal (painless)', price: '₹4,500',  note: 'Single sitting, rotary endodontics',         category: 'General',  duration: '60 min' },
      { name: 'Zirconia crown',        price: '₹8,000',  note: 'Digitally milled, shade matched',            category: 'Cosmetic', duration: '2 visits' },
      { name: 'Teeth whitening',       price: '₹6,500',  note: 'In-chair, three shades on average',          category: 'Cosmetic', duration: '75 min' },
      { name: 'Clear aligners',        price: '₹65,000', note: 'Full arch, scan and plan included',          category: 'Braces',   duration: '6-14 months' },
      { name: 'Metal braces',          price: '₹32,000', note: 'Including every adjustment visit',           category: 'Braces',   duration: '18-24 months' },
      { name: 'Dental implant',        price: '₹28,000', note: 'Titanium fixture, crown extra',              category: 'Surgical', duration: '2 stages' },
      { name: 'Wisdom tooth removal',  price: '₹3,500',  note: 'Surgical extraction under local anaesthetic', category: 'Surgical', duration: '45 min' },
      { name: 'Child check-up',        price: '₹250',    note: 'Counting teeth, no drills, no drama',        category: 'Kids',     duration: '20 min' },
      { name: 'Fluoride & sealants',   price: '₹1,500',  note: 'Per quadrant, protects new molars',          category: 'Kids',     duration: '30 min' }
    ]
  },

  /* ---------- 10. Why patients pick this clinic ---------- */
  /* `icon` points at one of the symbols defined at the top of
     index.html: #i-shield #i-rupee #i-clock #i-smile #i-card #i-chat */
  trust: {
    heading: 'The bits that actually worry people.',
    items: [
      { icon: '#i-shield', title: 'Sterilisation you can watch', body: 'Class B autoclave, pouches opened in front of you, cycle logs on the wall.' },
      { icon: '#i-rupee',  title: 'The price does not move',     body: 'Written estimate after the check-up. No add-ons discovered halfway through.' },
      { icon: '#i-clock',  title: 'Run to time',                 body: 'Appointment slots are real. If we run late, the desk rings you before you leave home.' },
      { icon: '#i-smile',  title: 'Genuinely painless',          body: 'Topical gel before every injection, and we stop the moment you raise a hand.' },
      { icon: '#i-card',   title: 'No-cost EMI',                 body: 'Three to twelve months on treatments above ₹10,000. Cashless on most panels.' },
      { icon: '#i-chat',   title: 'Hindi, English, Marathi',     body: 'Explained properly in whichever one you are most comfortable with.' }
    ]
  },

  /* ---------- 11. Clinicians ---------- */
  /* Photos: a URL, or a local path like 'assets/img/dr-rao.jpg'.
     Delete entries you do not need — the rail shrinks to fit. */
  team: {
    enabled: true,
    heading: 'You see the same dentist<br />every single visit.',
    note:    'Not a rota. Whoever starts your treatment finishes it, and their name is on your file.',
    members: [
      {
        name:  'Dr. Aditi Kulkarni',
        role:  'Principal dentist',
        bio:   'BDS, MDS Prosthodontics. Crowns, full-mouth rehab and the long rebuilds. Fourteen years in Baner.',
        image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=600&q=80'
      },
      {
        name:  'Dr. Rohan Deshpande',
        role:  'Endodontist',
        bio:   'MDS Conservative Dentistry. Single-sitting root canals and the cases other clinics send on.',
        image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80'
      },
      {
        name:  'Dr. Sneha Iyer',
        role:  'Orthodontist',
        bio:   'MDS Orthodontics. Plans every aligner case herself and shows you the scan on day one.',
        image: 'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?auto=format&fit=crop&w=600&q=80'
      },
      {
        name:  'Dr. Imran Shaikh',
        role:  'Oral surgeon',
        bio:   'MDS Oral & Maxillofacial Surgery. Implants and wisdom teeth. Six years on a hospital list first.',
        image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=600&q=80'
      }
    ]
  },

  /* ---------- 12. Practice photos ---------- */
  /* Straight from the client's Google Business Profile, or their
     own. Set enabled:false to drop the section — better than a
     grid of broken images when a prospect has no photos. */
  gallery: {
    enabled: true,
    heading: 'The actual clinic.',
    note:    'Every photo below was taken in the building. No stock, no renders.',
    images: [
      { src: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1000&q=80', alt: 'Reception and waiting area' },
      { src: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1000&q=80', alt: 'Imaging screen in the surgery' },
      { src: 'https://images.unsplash.com/photo-1629909615184-74f495363b67?auto=format&fit=crop&w=1000&q=80', alt: 'Treatment room with natural light' },
      { src: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=1000&q=80', alt: 'A dentist talking a patient through the plan' },
      { src: 'https://images.unsplash.com/photo-1616391182219-e080b4d1043a?auto=format&fit=crop&w=1000&q=80', alt: 'Chairside monitor showing a scan' },
      { src: 'https://images.unsplash.com/photo-1581056771107-24ca5f033842?auto=format&fit=crop&w=1000&q=80', alt: 'Sterilisation bay' }
    ]
  },

  /* ---------- 13. Google rating strip ---------- */
  reviewsMeta: {
    rating:  '4.9',
    count:   '612',
    heading: 'What patients wrote on Google.'
  },

  /* ---------- 14. A few review quotes ---------- */
  /* Copy real ones across from their Google listing. Keep them
     short — long quotes get truncated on a phone. Setting
     enabled:false (or leaving items empty) drops the quote rail
     while keeping the real Google score above it. */
  reviews: {
    enabled: true,
    items: [
      { quote: 'Got my root canal done in one sitting and genuinely felt nothing. The cost was exactly what they quoted on day one.', name: 'Prathamesh J.', meta: 'Root canal · 2 months ago' },
      { quote: 'Took my mother for dentures. They explained everything in Marathi, never rushed her, and adjusted them twice at no charge.', name: 'Vaishali K.', meta: 'Dentures · 5 weeks ago' },
      { quote: 'Aligners are halfway done and the difference is already obvious. Dr. Sneha shares the scan comparison at every visit.', name: 'Ankita R.', meta: 'Clear aligners · 3 months ago' },
      { quote: 'Walked in at 9pm with a broken tooth. They stayed back and fixed it. Charged the normal rate, not an emergency one.', name: 'Sameer D.', meta: 'Emergency · 1 month ago' }
    ]
  },

  /* ---------- 15. Common questions ---------- */
  faq: {
    heading: 'Questions we get asked every week.',
    items: [
      { q: 'Do I need an appointment, or can I walk in?',
        a: 'Walk-ins are seen between patients, so you may wait twenty minutes or so. Booking a slot means you are seen at that time. In pain today, just ring — we keep two slots free each day for exactly that.' },
      { q: 'Is the root canal really painless?',
        a: 'The area is fully numbed before anything starts, and we use topical gel before the injection itself. Most patients say the injection is the worst part, and that it is milder than they expected. You can raise a hand at any point and we stop.' },
      { q: 'Do you offer EMI, and is it really no-cost?',
        a: 'Yes, on treatments above ₹10,000, for three to twelve months. No-cost means you pay the treatment price split across the months, with no interest added. We handle the paperwork at the desk.' },
      { q: 'Will my insurance cover this?',
        a: 'We are on most cashless panels. Bring your card and we will check eligibility before treatment starts, so you know your share up front rather than at the end.' },
      { q: 'How long does a first visit take?',
        a: 'About twenty minutes. A check-up, an X-ray if it is needed, and a written estimate before you leave. Nothing is started on the first visit unless you are in pain and want it dealt with then.' }
    ]
  },

  /* ---------- 16. Sticky bar on phones ---------- */
  dock: {
    label: 'Consultation',
    price: '₹300',
    cta:   'Book now'
  }
};
