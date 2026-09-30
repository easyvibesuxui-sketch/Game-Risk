"""Build 42 territory silhouettes from Natural Earth 110m countries.

Usage (not part of the build; the output is committed):
    npm i world-atlas@2 topojson-client@3 && pip install shapely pillow
    node -e "const t=require('world-atlas/countries-110m.json'),{feature}=require('topojson-client');
             require('fs').writeFileSync('countries.json',JSON.stringify(feature(t,t.objects.countries)))"
    python3 scripts/make-map.py scripts/neighbors.json   # writes shapes.json + preview.png
Then convert shapes.json into src/game/map-shapes.ts (paths, label points, sea lanes).

Countries are grouped into territories; Russia, Canada, the USA and Australia
are cut by lon/lat boxes. All territories come from one partition of the same
country arcs, so shared borders stay coincident. No per-territory simplify.
"""
import json, math, sys
from shapely.geometry import shape, box, Polygon, MultiPolygon, mapping
from shapely.ops import unary_union, nearest_points, polylabel
from shapely.affinity import translate
from shapely import make_valid

W, H = 1400, 860
LON_STOPS = [(-170, 16), (-52, 372), (-25, 468), (45, 820), (150, 1268), (192, 1388)]
LAT_STOPS = [(-58, 852), (-35, 790), (0, 592), (35, 402), (60, 186), (84, 14)]


def lerp(v, stops):
    stops = sorted(stops)
    if v <= stops[0][0]:
        (a, pa), (b, pb) = stops[0], stops[1]
    elif v >= stops[-1][0]:
        (a, pa), (b, pb) = stops[-2], stops[-1]
    else:
        for (a, pa), (b, pb) in zip(stops, stops[1:]):
            if a <= v <= b:
                break
    return pa + (v - a) / (b - a) * (pb - pa)


def proj(lon, lat):
    return lerp(lon, LON_STOPS), lerp(lat, LAT_STOPS)


GROUPS = {
    # North America
    "greenland": ["Greenland"],
    "central_america": ["Mexico", "Guatemala", "Belize", "Honduras", "El Salvador", "Nicaragua",
                        "Costa Rica", "Panama", "Cuba", "Haiti", "Dominican Rep.", "Jamaica",
                        "Bahamas", "Puerto Rico"],
    # South America
    "venezuela": ["Venezuela", "Colombia", "Guyana", "Suriname", "Trinidad and Tobago"],
    "peru": ["Peru", "Ecuador", "Bolivia"],
    "brazil": ["Brazil"],
    "argentina": ["Argentina", "Chile", "Uruguay", "Paraguay", "Falkland Is."],
    # Europe
    "iceland": ["Iceland"],
    "great_britain": ["United Kingdom", "Ireland"],
    "scandinavia": ["Norway", "Sweden", "Finland"],
    "northern_europe": ["Germany", "Poland", "Denmark", "Netherlands", "Belgium", "Luxembourg",
                        "Czechia"],
    "western_europe": ["Spain", "Portugal"],
    "southern_europe": ["Italy", "Switzerland", "Austria", "Hungary", "Slovakia", "Slovenia",
                        "Croatia", "Bosnia and Herz.", "Serbia", "Montenegro", "Kosovo",
                        "Albania", "Macedonia", "Greece", "Bulgaria", "Romania"],
    "ukraine": ["Ukraine", "Belarus", "Moldova", "Estonia", "Latvia", "Lithuania"],
    # Africa
    "north_africa": ["Morocco", "W. Sahara", "Algeria", "Tunisia", "Mauritania", "Mali", "Niger",
                     "Chad", "Senegal", "Gambia", "Guinea-Bissau", "Guinea", "Sierra Leone",
                     "Liberia", "Côte d'Ivoire", "Burkina Faso", "Ghana", "Togo", "Benin",
                     "Nigeria"],
    "egypt": ["Egypt", "Libya"],
    "east_africa": ["Sudan", "S. Sudan", "Eritrea", "Djibouti", "Ethiopia", "Somalia",
                    "Somaliland", "Kenya", "Uganda", "Rwanda", "Burundi", "Tanzania"],
    "congo": ["Cameroon", "Central African Rep.", "Eq. Guinea", "Gabon", "Congo",
              "Dem. Rep. Congo", "Angola"],
    "south_africa": ["South Africa", "Namibia", "Botswana", "Zimbabwe", "Zambia", "Malawi",
                     "Mozambique", "Lesotho", "eSwatini"],
    "madagascar": ["Madagascar"],
    # Asia
    "mongolia": ["Mongolia"],
    "china": ["China", "Taiwan", "North Korea", "South Korea"],
    "afghanistan": ["Afghanistan", "Kazakhstan", "Turkmenistan", "Uzbekistan", "Kyrgyzstan",
                    "Tajikistan"],
    "middle_east": ["Turkey", "Syria", "Iraq", "Iran", "Israel", "Palestine", "Jordan", "Lebanon",
                    "Saudi Arabia", "Yemen", "Oman", "United Arab Emirates", "Qatar", "Kuwait",
                    "Georgia", "Armenia", "Azerbaijan", "Cyprus", "N. Cyprus"],
    "india": ["India", "Pakistan", "Nepal", "Bhutan", "Bangladesh", "Sri Lanka"],
    "siam": ["Myanmar", "Thailand", "Laos", "Cambodia", "Vietnam"],
    "japan": ["Japan"],
    # Australia
    "indonesia": ["Philippines", "Brunei", "Timor-Leste"],
    "new_guinea": ["Papua New Guinea"],
}

# Countries split by boxes: (territory, lon0, lat0, lon1, lat1). First match claims.
CUTS = {
    "Russia": [
        ("ukraine", -180, 0, 60, 90),
        ("ural", 60, 0, 80, 90),
        ("siberia", 80, 0, 100, 90),
        ("yakutsk", 100, 60, 145, 90),
        ("irkutsk", 100, 0, 135, 60),
        ("kamchatka", 135, 0, 200, 90),
    ],
    "Canada": [
        ("quebec", -80, 0, -50, 63),
        ("quebec", -68, 45, -50, 63),
        ("northwest_territory", -150, 60, -50, 90),
        ("alberta", -150, 0, -110, 60),
        ("ontario", -110, 0, -80, 60),
    ],
    "United States of America": [
        ("alaska", -180, 50, -129, 75),
        ("western_us", -130, 20, -98, 50),
        ("eastern_us", -98, 20, -60, 50),
    ],
    "Australia": [
        ("western_australia", 110, -45, 134, -10),
        ("eastern_australia", 134, -45, 160, -10),
    ],
    "France": [
        ("western_europe", -10, 40, 12, 52),
        ("venezuela", -56, 0, -50, 8),
    ],
    "Malaysia": [
        ("siam", 99, 0, 105, 8),
        ("indonesia", 108, 0, 120, 8),
    ],
    "Indonesia": [
        ("new_guinea", 134, -12, 142, 2),
        ("indonesia", 90, -12, 134, 8),
    ],
    "Norway": [("scandinavia", 0, 55, 35, 82)],
}

CONTINENT = {
    "na": ["alaska", "northwest_territory", "greenland", "alberta", "ontario", "quebec",
           "western_us", "eastern_us", "central_america"],
    "sa": ["venezuela", "peru", "brazil", "argentina"],
    "eu": ["iceland", "great_britain", "scandinavia", "northern_europe", "western_europe",
           "southern_europe", "ukraine"],
    "af": ["north_africa", "egypt", "east_africa", "congo", "south_africa", "madagascar"],
    "as": ["ural", "siberia", "yakutsk", "kamchatka", "irkutsk", "mongolia", "japan",
           "afghanistan", "china", "middle_east", "india", "siam"],
    "au": ["indonesia", "new_guinea", "western_australia", "eastern_australia"],
}
ALL = [t for ts in CONTINENT.values() for t in ts]
assert len(ALL) == 42

NEIGHBORS = json.load(open(sys.argv[1]))  # {id: [ids]}

feats = json.load(open("countries.json"))["features"]
parts = {t: [] for t in ALL}
from shapely.ops import transform


def load(f):
    g = shape(f["geometry"])
    if f["properties"]["name"] == "Russia":
        # Chukotka crosses the antimeridian: shift it east before any repair.
        g = transform(lambda x, y, z=None: (x + (x < 0) * 360, y), g)
    return make_valid(g).buffer(0)


by_name = {f["properties"]["name"]: load(f) for f in feats}
country_of = {c: t for t, cs in GROUPS.items() for c in cs}

for name, geom in by_name.items():
    if name in CUTS:
        rest = geom
        for t, a, b, c, d in CUTS[name]:
            piece = rest.intersection(box(a, b, c, d))
            rest = rest.difference(box(a, b, c, d))
            if not piece.is_empty:
                parts[t].append(piece)
        if rest.area > 0.5:
            print("leftover", name, round(rest.area, 2), [round(x) for x in rest.bounds])
    elif name in country_of:
        parts[country_of[name]].append(geom)

geo = {}
for t in ALL:
    g = unary_union(parts[t])
    polys = [p for p in (g.geoms if hasattr(g, "geoms") else [g]) if p.geom_type == "Polygon"]
    # Drop specks, keep the islands that make up island territories.
    big = max(p.area for p in polys)
    keep = [p for p in polys if p.area > max(0.25, big * 0.004)]
    geo[t] = MultiPolygon(keep)


def project_poly(p):
    ext = [proj(x, y) for x, y in p.exterior.coords]
    holes = [[proj(x, y) for x, y in r.coords] for r in p.interiors]
    return Polygon(ext, holes)


px = {t: MultiPolygon([project_poly(p) for p in g.geoms]) for t, g in geo.items()}


def ring_d(coords):
    pts = [(round(x, 1), round(y, 1)) for x, y in coords]
    out = []
    for p in pts:
        if not out or out[-1] != p:
            out.append(p)
    if len(out) > 1 and out[0] == out[-1]:
        out.pop()
    if len(out) < 3:
        return ""
    s = "M" + " ".join(f"{x:g},{y:g}" for x, y in out[:1])
    s += "L" + " ".join(f"{x:g},{y:g}" for x, y in out[1:]) + "Z"
    return s


paths, labels = {}, {}
for t, g in px.items():
    d = ""
    for p in g.geoms:
        d += ring_d(p.exterior.coords)
        for r in p.interiors:
            d += ring_d(r.coords)
    paths[t] = d
    main = max(g.geoms, key=lambda p: p.area)
    c = polylabel(main, tolerance=0.5)
    labels[t] = (round(c.x, 1), round(c.y, 1))

# Sea lanes: graph neighbours whose shapes do not touch.
lanes = []
seen = set()
for a, ns in NEIGHBORS.items():
    for b in ns:
        k = tuple(sorted((a, b)))
        if k in seen:
            continue
        seen.add(k)
        if k == ("alaska", "kamchatka"):
            lanes.append({"a": a, "b": b, "wrap": True})
            continue
        ga, gb = px[a], px[b]
        if ga.distance(gb) < 0.6:
            continue
        pa, pb = nearest_points(ga, gb)
        from shapely.geometry import LineString
        seg = LineString([pa, pb])
        others = unary_union([g for t, g in px.items() if t not in k])
        if seg.intersection(others).length > 8:
            continue
        lanes.append({"a": k[0], "b": k[1],
                      "from": [round(pa.x, 1), round(pa.y, 1)] if k[0] == a else [round(pb.x, 1), round(pb.y, 1)],
                      "to": [round(pb.x, 1), round(pb.y, 1)] if k[0] == a else [round(pa.x, 1), round(pa.y, 1)]})

# Wrap lane anchors: Alaska's west tip and Kamchatka's east tip.
for lane in lanes:
    if lane.get("wrap"):
        ak = px["alaska"]; km = px["kamchatka"]
        amin = min(ak.geoms, key=lambda p: p.bounds[0]).bounds
        kmax = max(km.geoms, key=lambda p: p.bounds[2]).bounds
        ax = ak.bounds[0]; kx = km.bounds[2]
        ay = min((y for p in ak.geoms for x, y in p.exterior.coords if x < ax + 6), default=80)
        ky = min((y for p in km.geoms for x, y in p.exterior.coords if x > kx - 6), default=80)
        lane["from"] = [round(ax, 1), round(ay, 1)]
        lane["to"] = [round(kx, 1), round(ky, 1)]

land = unary_union(list(px.values()))
json.dump({"paths": paths, "labels": labels, "lanes": lanes,
           "bounds": {t: [round(v, 1) for v in g.bounds] for t, g in px.items()},
           "area": {t: round(g.area) for t, g in px.items()}},
          open("shapes.json", "w"))

# Preview
from PIL import Image, ImageDraw
COL = {"na": "#e3c84e", "sa": "#e07a38", "eu": "#7ea0d0", "af": "#d86b6b", "as": "#6fa86a", "au": "#b08cc8"}
cont_of = {t: c for c, ts in CONTINENT.items() for t in ts}
im = Image.new("RGB", (W, H), "#efe4c8"); dr = ImageDraw.Draw(im)
for t, g in px.items():
    for p in g.geoms:
        dr.polygon(list(p.exterior.coords), fill=COL[cont_of[t]], outline="#2f2418")
for l in lanes:
    dr.line([tuple(l["from"]), tuple(l["to"])], fill="#2f2418", width=1)
for t, (x, y) in labels.items():
    dr.ellipse((x - 6, y - 6, x + 6, y + 6), fill="#9a2f2f")
    dr.text((x + 8, y - 6), t[:10], fill="#000")
im.save("preview.png")
print("bytes", sum(len(v) for v in paths.values()))
print("lanes", [(l["a"], l["b"]) for l in lanes])

