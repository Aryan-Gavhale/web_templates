"""First-run demo content.

Everything here is ordinary data the owner can edit or delete from the admin —
there is no hard-coded copy anywhere in the theme. Seeding runs once, guarded
by the `seeded` flag in settings.
"""

from datetime import date, timedelta

from . import settings as cfg
from .auth import hash_password
from .db import insert, now, q, q1
from .money import add_months, iso, schedule

DEMO_EMAIL = "owner@aarohi.design"
DEMO_PASSWORD = "aarohi2026"

U = "https://images.unsplash.com/{id}?auto=format&fit=crop&w=1800&q=80"
UT = "https://images.unsplash.com/{id}?auto=format&fit=crop&w=640&q=70"


def _media(photo_id: str, alt: str) -> int:
    return insert("media", {
        "kind": "remote",
        "filename": "",
        "thumb": UT.format(id=photo_id),
        "url": U.format(id=photo_id),
        "original_name": photo_id + ".jpg",
        "mime": "image/jpeg",
        "bytes": 0,
        "width": 1800,
        "height": 1200,
        "alt": alt,
        "created_at": now(),
    })


PHOTOS = {
    "hero":      ("photo-1693382464372-fad822e7b38c", "A calm living room with a curved sofa and soft afternoon light"),
    "screens":   ("photo-1772797583328-f83bc3f94f80", "A living space divided by slatted timber screens"),
    "artwall":   ("photo-1583847268964-b28dc8f51f92", "A neutral living room with framed art above a low sofa"),
    "bathdark":  ("photo-1754522711595-84428937b07a", "A dark marble bathroom with a stone basin"),
    "bathstone": ("photo-1760749124145-8ceea3f541b5", "A bathroom vanity in warm stone with brass fittings"),
    "bathwood":  ("photo-1763485956310-55f3c0e822d5", "A timber vanity with twin basins under a long mirror"),
    "dining":    ("photo-1693382464188-1ed395d8d3e1", "A bright dining room with timber chairs and a pendant light"),
    "desk":      ("photo-1611269154421-4e27233ac5c7", "A writing desk beside a tall window"),
    "bedroom":   ("photo-1724582586413-6b69e1c94a17", "A quiet bedroom under a sloped ceiling"),
    "soft":      ("photo-1682774774505-2496b7107727", "A soft neutral sitting room with a low armchair"),
    "stove":     ("photo-1723748972084-4124765e0a55", "A living room with a wood stove and large windows"),
    "kitchen":   ("photo-1630184604932-665d42cfcc69", "A bright kitchen opening onto a dining table"),
    "rattan":    ("photo-1615529179035-e760f6a2dcee", "A warm living room lit by woven pendant shades"),
    "green":     ("photo-1654506012740-09321c969dc2", "A dining area framed by deep green drapery"),
    "linen":     ("photo-1750639258774-9a714379a093", "A linen sofa against a plain plastered wall"),
    "swatch":    ("photo-1667400104764-a5fd01a919b0", "A hand fanning out paint swatches"),
    "samples":   ("photo-1752321531399-1e2b66043b52", "Stone, timber and fabric samples laid out on a table"),
    "sketch":    ("photo-1649688066826-947419c66e5c", "Hands drawing a plan over a sheet of tracing paper"),
    "drawing":   ("photo-1598368195835-91e67f80c9d7", "A designer marking up a drawing at a desk"),
    "slats":     ("photo-1636505682026-143d63c8edd2", "A close view of fluted timber panelling"),
}


def _seed_media() -> dict:
    return {key: _media(pid, alt) for key, (pid, alt) in PHOTOS.items()}


SECTIONS = [
    ("hero", "Hero", "The first screen — headline, opening line and the main photograph.", {
        "eyebrow": "Interior design & turnkey delivery · Bengaluru",
        "heading": "Rooms that hold their calm long after the styling is gone.",
        "body": "We design homes and workplaces the slow way — measured on site, drawn "
                "in full, made by people we know. Eleven years, one workshop, no shortcuts.",
        "cta_label": "Start a project",
        "cta_href": "#enquire",
        "extra": "See our work|#work",
    }),
    ("intro", "Introduction", "The short paragraph under the hero that explains the practice.", {
        "eyebrow": "The practice",
        "heading": "A small studio that draws every joint before it is made.",
        "body": "Studio Aarohi is fifteen people — designers, a costing team and a joinery "
                "workshop in Peenya. We keep the studio small on purpose. It means the person "
                "who drew your kitchen is the person standing in it on the day it is installed, "
                "and it means we can say no to work we cannot do properly.\n\n"
                "We work across full-home interiors, renovations and workplaces, and we deliver "
                "turnkey — one contract, one timeline, one team answerable for it.",
        "cta_label": "Our process",
        "cta_href": "#process",
    }),
    ("services", "Services header", "Heading above the services grid.", {
        "eyebrow": "What we do",
        "heading": "Six ways we work",
        "body": "Whether it is a whole home or a single room done properly, the drawings, "
                "the costing and the site supervision are the same.",
    }),
    ("work", "Work header", "Heading above the project grid.", {
        "eyebrow": "Selected work",
        "heading": "Recent projects",
        "body": "A cross-section of what has left the workshop over the last two years.",
    }),
    ("process", "Process header", "Heading above the process steps.", {
        "eyebrow": "How it runs",
        "heading": "From first call to the day you move back in",
        "body": "Every project follows the same five stages. You always know which one you "
                "are in, what it costs and what happens next.",
    }),
    ("reviews", "Reviews header", "Heading above the reviews carousel.", {
        "eyebrow": "In their words",
        "heading": "What our clients say",
        "body": "Pulled live from our Google Business profile, unedited.",
    }),
    ("cta", "Closing band", "The full-width band just before the enquiry form.", {
        "eyebrow": "Ready when you are",
        "heading": "Tell us about the space.",
        "body": "Send us the plan, a few photographs, or nothing at all. The first "
                "conversation is free and there is no obligation after it.",
        "cta_label": "Book a consultation",
        "cta_href": "#enquire",
    }),
    ("enquire", "Enquiry form", "Heading beside the enquiry form.", {
        "eyebrow": "Start here",
        "heading": "Let's talk about your project",
        "body": "Fill this in and we will come back within one working day with a time "
                "for a call. Everything you send stays with the studio.",
    }),
]

SERVICES = [
    ("Full home interiors", "full-home-interiors", "photo_key:hero",
     "Turnkey design and delivery for apartments and villas — from the first measured survey to the day you move back in.",
     "We take the whole home: layouts, services coordination, joinery, false ceilings, "
     "flooring, lighting, soft furnishing and the snag list at the end. One contract, "
     "one project manager, one number to call.\n\nMost full homes run 14 to 20 weeks on "
     "site depending on the scope of civil work.", 1450000, "typical 3BHK, all-in"),
    ("Modular kitchens & wardrobes", "modular-kitchens-wardrobes", "photo_key:kitchen",
     "Cabinetry drawn around how you actually cook and dress, then built in our own workshop.",
     "Every carcass is 18 mm BWP ply, every shutter is finished and cured before it "
     "leaves Peenya, and every hinge and channel is Hettich or Blum with the warranty in "
     "your name.\n\nWe survey, draw in 3D, agree the finish samples with you and install "
     "in two to three days per room.", 320000, "per kitchen, from"),
    ("Renovation & retrofit", "renovation-retrofit", "photo_key:artwall",
     "Older homes brought up to date without losing what made them worth keeping.",
     "Cooke Town bungalows, Malleswaram flats, 1990s builder apartments — we survey "
     "the structure and services first, tell you honestly what is worth saving, and "
     "sequence the work so you can often stay in part of the house.\n\nWe handle the "
     "association paperwork and the debris clearance too.", 850000, "part renovation, from"),
    ("Workplace & retail", "workplace-retail", "photo_key:desk",
     "Offices, studios and small-format retail designed for the way the team really works.",
     "Space planning against headcount, acoustics that let people concentrate, cable "
     "management that survives contact with reality, and a fit-out programme that works "
     "around your notice period on the old lease.\n\nWe have delivered up to 12,000 sq ft.",
     1800, "per sq ft, from"),
    ("Furniture & joinery", "furniture-joinery", "photo_key:slats",
     "One-off pieces made in our workshop when nothing off the shelf will do.",
     "Dining tables, beds, study units, pooja units, bar cabinets, panelling. Drawn to "
     "the millimetre, made in teak, oak, ash or veneered ply, and finished in PU, "
     "polish or oil.\n\nLead time is typically four to six weeks from sign-off.",
     45000, "per piece, from"),
    ("Styling & handover", "styling-handover", "photo_key:linen",
     "The last ten percent — the part most projects skip, and the part you actually live with.",
     "Rugs, lighting, art, cushions, planting and the crockery in the right cupboard. "
     "We shop it, we stage it, and we photograph it before you move in.\n\nAvailable as a "
     "standalone service for homes we did not design.", 180000, "per home, from"),
]

PROJECTS = [
    ("Indiranagar Duplex", "indiranagar-duplex", "Residence", "Bengaluru", "2025", "3,200 sq ft",
     "A tired builder duplex opened up into one continuous ground floor, with a joinery "
     "spine running the length of the plan.",
     "The clients had lived here for six years and never used the formal living room. We "
     "took out the wall between it and the dining, moved the kitchen to the garden side and "
     "ran a single 11-metre joinery wall from the entrance to the rear door — shoe storage, "
     "crockery, bar, television and a study niche all inside one plane of fluted teak.\n\n"
     "Upstairs stayed largely intact. We rebuilt the two bathrooms in Kotah and brass, "
     "replaced every light fitting and left the bedrooms quiet.\n\n"
     "Sixteen weeks on site. The family stayed in the upper floor for eleven of them.",
     "hero", ["screens", "slats", "bathstone", "artwall"], 1),
    ("Cooke Town Restoration", "cooke-town-restoration", "Residence", "Bengaluru", "2024", "2,450 sq ft",
     "A 1940s bungalow returned to its proportions, with a new kitchen and two bathrooms "
     "inserted without touching the original openings.",
     "Almost everything worth keeping was already there — Madras terrace ceilings, teak "
     "windows, red-oxide floors under three layers of vitrified tile. The work was mostly "
     "subtraction.\n\nWe lifted the tile, restored the oxide, repaired the windows rather "
     "than replacing them, and put the new services in a service corridor along the rear so "
     "no original wall was chased.\n\nThe kitchen and bathrooms are frankly contemporary. "
     "There was no point pretending otherwise.",
     "artwall", ["stove", "bathdark", "dining", "green"], 1),
    ("Sadashivanagar Villa", "sadashivanagar-villa", "Residence", "Bengaluru", "2025", "5,800 sq ft",
     "A new-build villa fitted out end to end, with a double-height living room held "
     "together by a single stone hearth.",
     "We came in at shell stage, which is the best time to arrive. Services were routed "
     "before the ceilings closed, the stone was selected off the block at the quarry in "
     "Kishangarh, and the joinery was drawn against the structural grid rather than "
     "apologising for it.\n\nThe brief asked for 'quiet, not cold'. The answer was warm "
     "stone, a lot of oak, and only three materials in any one room.",
     "screens", ["soft", "bedroom", "bathwood", "rattan"], 1),
    ("Whitefield Apartment", "whitefield-apartment", "Residence", "Bengaluru", "2024", "1,850 sq ft",
     "A 3BHK for a couple who cook seriously — the kitchen took a third of the budget "
     "and all of the argument.",
     "An island was impossible, so we ran a 3.6 m working wall with everything within one "
     "step: induction, a proper extractor cored through the external wall, a landing zone "
     "either side of the hob and a tall pantry that swallows a month of groceries.\n\n"
     "The rest of the flat is deliberately plain so the kitchen can be the event.",
     "kitchen", ["dining", "linen", "bedroom"], 1),
    ("Church Street Studio", "church-street-studio", "Workplace", "Bengaluru", "2024", "4,100 sq ft",
     "A design consultancy's own office — twenty-two desks, three meeting rooms and "
     "acoustics that survive a Monday.",
     "Open-plan offices fail on sound long before they fail on space. We treated the "
     "ceiling across the whole floorplate, put felt on every vertical surface above desk "
     "height, and gave the team four small phone rooms instead of one large one nobody "
     "books.\n\nThe fit-out ran over a single fortnight while the team worked remotely.",
     "desk", ["soft", "slats"], 0),
    ("Jayanagar Kitchen", "jayanagar-kitchen", "Renovation", "Bengaluru", "2025", "220 sq ft",
     "One room, ten days, no civil work — proof that a single space done properly "
     "changes a whole house.",
     "The client wanted to test us before handing over a larger project. Fair enough.\n\n"
     "We replaced the cabinetry, re-clad the walls in a glazed handmade tile, moved two "
     "points and put in lighting that lets you actually see the chopping board. No walls "
     "moved and no plumbing was re-routed.\n\nThe larger project started in March.",
     "green", ["kitchen", "samples"], 0),
]

PROCESS = [
    ("Consultation & brief", "Week 1",
     "We visit, measure, and listen. You get an honest read on what the space can take "
     "and a budget range before you have spent anything."),
    ("Concept & material board", "Weeks 2–3",
     "Layout options, a physical board of the actual samples, and a walkthrough. We "
     "expect to revise this once — it is cheaper to change your mind here than later."),
    ("Drawings & fixed costing", "Weeks 4–6",
     "Full working drawings, elevations for every joinery item, and a line-by-line "
     "quotation. The number you sign is the number you pay unless you change the scope."),
    ("Execution & site", "Weeks 7–16",
     "Your project manager posts photographs every Friday and holds a fortnightly site "
     "meeting. Payments are released against completed stages, never against dates."),
    ("Styling & handover", "Week 17",
     "Deep clean, styling, a photographed snag list closed before handover, and a folder "
     "with every warranty, paint code and appliance manual in it."),
]

STATS = [
    ("Homes delivered", "184", ""),
    ("Years in practice", "11", ""),
    ("Handed over on time", "96", "%"),
    ("Average Google rating", "4.9", ""),
]

TESTIMONIALS = [
    ("Meera Raghunathan", "Indiranagar duplex", 5,
     "We interviewed four studios and Aarohi were the only ones who came back with a "
     "drawing instead of a mood board. Sixteen weeks, one revision to the quote, and the "
     "joinery wall is the thing every single guest comments on."),
    ("Arvind & Sneha Kulkarni", "Cooke Town restoration", 5,
     "They talked us out of two things we wanted and were right about both. The red oxide "
     "floor under the tiles was their find. Careful, unhurried people who clearly like old "
     "houses."),
    ("Rohit Menon", "Whitefield apartment", 5,
     "I cook every day and I have opinions. Priya sat in the kitchen with a tape measure "
     "for two hours before drawing anything. Everything is exactly where my hand expects it."),
    ("Deepa Shetty", "Jayanagar kitchen", 5,
     "We gave them one small room as a test. Ten days, no dust in the rest of the house, "
     "and they finished on the day they said. They are now doing the whole first floor."),
    ("Kartik Iyer", "Church Street Studio", 4,
     "Good process and genuinely excellent on acoustics, which was our main worry. Delivery "
     "of two meeting tables slipped by a week — they flagged it early and credited us for it."),
]

ENQUIRIES = [
    ("Nandita Bose", "nandita.bose@example.com", "+91 98450 11221", "Bengaluru",
     "full-home-interiors", "₹15–30 L", "Within 3 months",
     "We've just taken possession of a 3BHK in Hebbal and would like to do the whole flat. "
     "Handover is in March. Could we get a rough idea of cost and timeline?",
     "website", "new", "high", 0),
    ("Sameer Qureshi", "sameer.q@example.com", "+91 99001 45677", "Bengaluru",
     "modular-kitchens-wardrobes", "₹5–15 L", "Immediately",
     "Only the kitchen and two wardrobes. Existing flat, we live here. Is that something "
     "you take on?",
     "website", "new", "normal", 1),
    ("Lavanya Prasad", "lavanya.p@example.com", "+91 80500 33445", "Mysuru",
     "renovation-retrofit", "₹30–60 L", "3–6 months",
     "A 1960s house in Mysuru that has been in the family for a while. Needs everything. "
     "Would you travel for this?",
     "google", "contacted", "high", 3),
    ("Vikram Nair", "vikram@example.com", "+91 97400 55667", "Bengaluru",
     "workplace-retail", "Above ₹60 L", "Within 3 months",
     "8,000 sq ft office in Koramangala, lease starts in six weeks. Need a fit-out partner "
     "who can move quickly. Happy to share the floor plate.",
     "referral", "quoted", "high", 6),
    ("Anjali Deshpande", "anjali.d@example.com", "+91 90080 77889", "Bengaluru",
     "styling-handover", "Under ₹5 L", "Immediately",
     "Our home was done two years ago and it still feels unfinished. Looking for someone "
     "to style it properly.",
     "instagram", "contacted", "normal", 4),
    ("Farhan Sheikh", "farhan.s@example.com", "+91 96320 99001", "Bengaluru",
     "full-home-interiors", "₹15–30 L", "Just exploring",
     "Early stages, we haven't booked the flat yet. Wanted to understand how you cost "
     "things before we commit.",
     "website", "qualified", "low", 9),
    ("Priyanka Rao", "priyanka.rao@example.com", "+91 98860 22334", "Bengaluru",
     "furniture-joinery", "Under ₹5 L", "Within 3 months",
     "Looking for a 8-seater dining table in solid teak, plus two benches. Saw the one on "
     "your Instagram.",
     "instagram", "won", "normal", 14),
    ("Gopal Krishnan", "gopal.k@example.com", "+91 94480 66778", "Chennai",
     "full-home-interiors", "₹30–60 L", "3–6 months",
     "Villa in Chennai. Understand you're Bengaluru-based but wanted to ask.",
     "google", "lost", "low", 21),
    ("Ritu Malhotra", "ritu.m@example.com", "+91 99720 88990", "Bengaluru",
     "renovation-retrofit", "₹15–30 L", "Within 3 months",
     "Two bathrooms and the kitchen in a 15-year-old apartment in Koramangala. "
     "The rest is fine.",
     "website", "new", "normal", 0),
]

CLIENTS = [
    ("Meera Raghunathan", "meera.r@example.com", "+91 98450 44556",
     "412, Ashwini Layout, 3rd Cross", "Bengaluru", "Indiranagar duplex. Prefers WhatsApp."),
    ("Arvind Kulkarni", "arvind.k@example.com", "+91 99860 12345",
     "8 Wheeler Road Extension", "Bengaluru", "Cooke Town restoration. Invoices to the HUF account."),
    ("Rohit Menon", "rohit.menon@example.com", "+91 97310 99887",
     "Prestige Shantiniketan, Tower 6", "Bengaluru", "Whitefield apartment. Travels a lot — email first."),
    ("Deepa Shetty", "deepa.shetty@example.com", "+91 90350 77665",
     "22, 9th Main, Jayanagar 4th Block", "Bengaluru", "Kitchen done. First floor starting March."),
    ("Kartik Iyer", "kartik@example.com", "+91 88670 55443",
     "Church Street, Level 3", "Bengaluru", "Workplace client. Raise invoices with GSTIN on file."),
]

# (client index, title, total, discount, downpayment, interest_type, pct, tenure,
#  months to back-date the start, instalments settled in full, part-paid fraction
#  of the next one)
#
# `settled` is deliberately behind the number of months elapsed on two of these,
# so the demo shows what a real book looks like: some clients late, one part
# paying, one finished. A tidy seed hides half the interface.
PLANS = [
    (0, "Indiranagar duplex — turnkey interiors", 3850000, 50000, 962500, "none", 0, 8, 6, 4, 0.4),
    (1, "Cooke Town restoration — phase 1", 2240000, 0, 560000, "flat", 9, 12, 8, 8, 0),
    (2, "Whitefield apartment — kitchen & wardrobes", 1180000, 30000, 295000, "reducing", 11, 6, 4, 2, 0),
    (3, "Jayanagar kitchen renovation", 486000, 0, 146000, "none", 0, 4, 5, 4, 0),
    (4, "Church Street Studio — office fit-out", 6420000, 120000, 1605000, "flat", 8, 10, 2, 2, 0),
]


def _slug_map(rows):
    return {r["slug"]: r["id"] for r in rows}


def seed_if_empty() -> bool:
    """Populate demo content on a fresh database. Returns True if it ran."""
    if cfg.get("seeded") == "1":
        return False
    if q1("SELECT id FROM users LIMIT 1"):
        cfg.set("seeded", "1")
        return False

    today = date.today()
    m = _seed_media()

    insert("users", {
        "email": DEMO_EMAIL,
        "name": "Priya Aarohi",
        "password_hash": hash_password(DEMO_PASSWORD),
        "role": "owner",
        "created_at": now(),
    })

    for i, (key, name, hint, data) in enumerate(SECTIONS, start=1):
        image_id = None
        if key == "hero":
            image_id = m["hero"]
        elif key == "intro":
            image_id = m["sketch"]
        elif key == "cta":
            image_id = m["rattan"]
        insert("sections", {
            "key": key, "name": name, "hint": hint,
            "eyebrow": data.get("eyebrow", ""), "heading": data.get("heading", ""),
            "body": data.get("body", ""), "cta_label": data.get("cta_label", ""),
            "cta_href": data.get("cta_href", ""), "extra": data.get("extra", ""),
            "image_id": image_id, "position": i, "is_visible": 1, "updated_at": now(),
        })

    for i, (title, slug, photo, summary, body, price, note) in enumerate(SERVICES, start=1):
        insert("services", {
            "title": title, "slug": slug, "summary": summary, "body": body,
            "price_from": price, "price_note": note,
            "image_id": m[photo.split(":")[1]], "position": i, "is_visible": 1,
            "created_at": now(), "updated_at": now(),
        })

    for i, (title, slug, cat, loc, year, area, summary, body, cover, gallery, feat) in \
            enumerate(PROJECTS, start=1):
        pid = insert("projects", {
            "title": title, "slug": slug, "category": cat, "location": loc,
            "year": year, "area": area, "summary": summary, "body": body,
            "cover_id": m[cover], "position": i, "is_visible": 1, "is_featured": feat,
            "created_at": now(), "updated_at": now(),
        })
        for j, key in enumerate(gallery, start=1):
            insert("project_images", {
                "project_id": pid, "media_id": m[key],
                "caption": PHOTOS[key][1], "position": j,
            })

    for i, (title, duration, body) in enumerate(PROCESS, start=1):
        insert("process_steps", {"title": title, "duration": duration, "body": body,
                                 "position": i, "is_visible": 1})

    for i, (label, value, suffix) in enumerate(STATS, start=1):
        insert("stats", {"label": label, "value": value, "suffix": suffix,
                         "position": i, "is_visible": 1})

    for i, (author, role, rating, body) in enumerate(TESTIMONIALS, start=1):
        insert("testimonials", {
            "source": "manual", "google_review_id": None, "author": author,
            "author_photo": "", "role": role, "rating": rating, "body": body,
            "review_time": iso(today - timedelta(days=30 * i)),
            "relative_time": f"{i} month{'s' if i > 1 else ''} ago",
            "profile_url": "", "is_visible": 1, "is_featured": 1 if i <= 3 else 0,
            "position": i, "created_at": now(),
        })

    services = _slug_map(q("SELECT id, slug FROM services"))
    for n, (name, email, phone, city, svc, budget, timeline, message,
            source, status, priority, days_ago) in enumerate(ENQUIRIES, start=1):
        created = today - timedelta(days=days_ago)
        eid = insert("enquiries", {
            "ref": f"ENQ-{created.strftime('%y%m')}-{n:03d}",
            "name": name, "email": email, "phone": phone, "city": city,
            "service_id": services.get(svc), "budget_band": budget, "timeline": timeline,
            "message": message, "source": source, "status": status, "priority": priority,
            "is_archived": 0,
            "created_at": created.isoformat() + "T09:30:00+00:00",
            "updated_at": created.isoformat() + "T09:30:00+00:00",
            "last_contacted_at": (created + timedelta(days=1)).isoformat()
            if status not in ("new",) else None,
        })
        if status == "quoted":
            insert("enquiry_notes", {
                "enquiry_id": eid, "author": "Priya Aarohi", "created_at": now(),
                "body": "Sent the stage-1 quote and the Church Street case study. "
                        "Chasing a site visit for next Tuesday.",
            })
        if status == "lost":
            insert("enquiry_notes", {
                "enquiry_id": eid, "author": "Priya Aarohi", "created_at": now(),
                "body": "Out of our delivery radius — referred to Studio Kanchi in Chennai.",
            })

    client_ids = [insert("clients", {
        "name": n, "email": e, "phone": p, "address": a, "city": c,
        "notes": note, "created_at": now(),
    }) for n, e, p, a, c, note in CLIENTS]

    for n, (ci, title, total, disc, down, itype, pct, tenure, back, settled, part) in \
            enumerate(PLANS, start=1):
        start = add_months(today, -back)
        rows, _ = schedule(total, disc, down, itype, pct, tenure, start)
        plan_id = insert("payment_plans", {
            "ref": f"PLAN-{today.year}-{n:03d}", "client_id": client_ids[ci], "title": title,
            "total_amount": total, "discount": disc, "downpayment": down,
            "interest_type": itype, "interest_pct": pct, "tenure_months": tenure,
            "start_date": iso(start),
            "status": "completed" if settled >= tenure else "active",
            "note": "", "created_at": now(), "updated_at": now(),
        })
        for r in rows:
            paid = 0.0
            paid_on = None
            method = ""
            if r["seq"] <= settled:
                paid = r["amount"]
                paid_on = r["due_date"]
            elif part and r["seq"] == settled + 1:
                paid = round(r["amount"] * part)
                paid_on = r["due_date"]
            if paid:
                method = ["UPI", "NEFT", "Cheque"][r["seq"] % 3]
            insert("installments", {
                "plan_id": plan_id, "seq": r["seq"], "label": r["label"],
                "due_date": r["due_date"], "amount": r["amount"],
                "paid_amount": paid, "paid_on": paid_on, "method": method,
                "reference": f"TXN{plan_id}{r['seq']:02d}" if paid else "", "note": "",
            })

    insert("activity", {
        "user_name": "system", "action": "seeded", "entity": "site", "entity_id": None,
        "summary": "Demo content installed — sections, services, six projects, "
                   "reviews, enquiries and payment plans.",
        "created_at": now(),
    })

    cfg.set("seeded", "1")
    return True
