import re
import csv

INPUT_FILE = "raw.txt"
OUTPUT_FILE = "players_all.csv"

# Columns we will output (clean, DB-ready)
FIELDS = [
    "Team","Player","Position","MIN","OnBall_pct",
    "DPM","ODPM","DDPM",
    "PTS","AST","REB",
    "TS_pct","TOV",
    "TwoP_pct","ThreeP_pct","ThreePA",
    "FT_pct","FTA",
    "OREB","DREB","STL","BLK"
]

# Helpers
def to_float(x):
    try:
        return float(x)
    except:
        return None

def clean_percent(x):
    # "34.5%" -> 34.5 ; "-%" -> None
    x = x.strip()
    if x in ("-%", "-", ""):
        return None
    if x.endswith("%"):
        x = x[:-1]
    return to_float(x)

def scan_numeric_tokens(block_text):
    """
    Extract the 'value' tokens the way your table prints:
    - For percent metrics: "34.5%" is a token
    - For +/- metrics: "+1.7" "-0.3" are tokens
    - For normal numeric: "1410", "7.7", "89.2%" etc.
    IMPORTANT: We ignore the percentile ranks (the integers like 99, 74, 52)
    by taking only:
      - any token that is % (percent)
      - any token that starts with + or - and has a decimal
      - any token that has a decimal (e.g. 7.7, 31.3)
      - MIN is usually an integer (1410) but it comes right after Team/Pos line,
        so we grab it separately.
    """
    tokens = []

    # percent tokens like 34.5%
    tokens += re.findall(r"\b-?\d+(?:\.\d+)?%", block_text)

    # plus/minus decimals like +1.7 -0.3 +10.2%
    tokens += re.findall(r"[+-]\d+(?:\.\d+)", block_text)

    # decimal numbers like 7.7 31.3 0.0 100.0
    tokens += re.findall(r"\b\d+\.\d+\b", block_text)

    return tokens

def parse_players(text):
    """
    We find each player "card" by:
      TEAM (3 letters)
      Player Name line
      "TEAM • POS" line
      then numeric rows until next TEAM header or EOF
    """
    # Normalize
    text = text.replace("\r\n", "\n")

    # A "player start" looks like:
    # MEM
    # Ja Morant
    # MEM • PG
    # ...
    pattern = re.compile(
        r"(?m)^(?P<team>[A-Z]{3})\s*\n(?P<name>[^\n]+)\s*\n(?P=team)\s*•\s*(?P<pos>[A-Za-z]+)\s*\n(?P<body>.*?)(?=^[A-Z]{3}\s*\n[^\n]+\s*\n[A-Z]{3}\s*•|\Z)",
        re.S
    )

    players = []
    for m in pattern.finditer(text):
        team = m.group("team").strip()
        name = m.group("name").strip()
        pos = m.group("pos").strip()
        body = m.group("body")

        # MIN is the first integer in body (e.g. 1410)
        min_match = re.search(r"\b(\d{1,5})\b", body)
        MIN = int(min_match.group(1)) if min_match else None

        # OnBall% is the first percent token in body (often right after MIN & mpg)
        # But "mpg" is also present (e.g. 34.4). We'll parse using a more stable method:
        # After MIN, the next decimal is mpg, then the next percent is OnBall%.
        after_min = body[min_match.end():] if min_match else body
        mpg_match = re.search(r"\b\d+\.\d+\b", after_min)
        after_mpg = after_min[mpg_match.end():] if mpg_match else after_min
        onball_match = re.search(r"\b-?\d+(?:\.\d+)?%\b|-?%\b|-%\b", after_mpg)
        OnBall = None
        if onball_match:
            OnBall = clean_percent(onball_match.group(0))

        # Now extract key metric values in the exact order from the raw layout:
        # DPM, ODPM, DDPM are +/- decimals
        dpm = re.search(r"(?m)^[^\n]*\n.*?\b([+-]\d+(?:\.\d+))\b", body)
        # But that's unreliable; better: pick first 3 +/- decimal tokens after OnBall%.
        # We'll tokenize from after OnBall token.
        cut_idx = onball_match.end() if onball_match else 0
        tail = after_mpg[cut_idx:] if mpg_match else body

        plus_minus = re.findall(r"[+-]\d+(?:\.\d+)", tail)
        DPM = to_float(plus_minus[0]) if len(plus_minus) > 0 else None
        ODPM = to_float(plus_minus[1]) if len(plus_minus) > 1 else None
        DDPM = to_float(plus_minus[2]) if len(plus_minus) > 2 else None

        # For the rest (PTS, AST, REB, TS%, TOV, 2P%, 3P%, 3PA, FT%, FTA, OREB, DREB, STL, BLK)
        # We'll pick them by scanning the "real value" tokens pattern from the block
        # and then selecting in a robust way:
        #
        # We use the fact that your table prints the "value" first, then rank.
        # Easiest: read line-by-line and grab the first number-ish token on each stat line.
        #
        # We'll do a more direct parse: find occurrences of these "value formats" in order they appear:
        # - PTS value is a decimal (e.g. 32.0)
        # - AST value is a decimal (e.g. 2.1)
        # - REB value is a decimal (e.g. 7.0)
        # - TS% is a percent token
        # - TOV is a decimal (e.g. 1.5)
        # - 2P% percent token
        # - 3P% percent token
        # - 3PA decimal
        # - FT% percent token
        # - FTA decimal
        # - OREB decimal
        # - DREB decimal
        # - STL decimal
        # - BLK decimal
        #
        # We'll extract all percents + decimals in body and then pick them with heuristics.
        percents = re.findall(r"\b-?\d+(?:\.\d+)?%\b", body)
        decimals = re.findall(r"\b\d+\.\d+\b", body)

        # decimals contain mpg + a lot of others; remove mpg (first decimal after MIN)
        if mpg_match:
            mpg_val = mpg_match.group(0)
            # remove first occurrence
            removed = False
            new_decimals = []
            for d in decimals:
                if not removed and d == mpg_val:
                    removed = True
                    continue
                new_decimals.append(d)
            decimals = new_decimals

        # Now the first few decimals after DPM/ODPM/DDPM section are usually:
        # PTS, PTS (created), PTS, AST, Rim AST, REB ...
        # We'll take:
        # PTS = first decimal >= 0 after removing mpg
        # Then AST = next decimal that is plausibly <= 15 (guards can be 10, bigs lower)
        # REB = next decimal plausibly <= 20
        # But we need stable picking: in your dumps, the actual sequence is:
        # PTS, (some created points), PTS, AST, Rim AST, REB ...
        #
        # So: PTS = decimals[0]
        # AST = decimals[3]
        # REB = decimals[5]
        # TOV = decimals[?] after TS% and rTS% noise; we will locate TS% first from percents list order.
        PTS = to_float(decimals[0]) if len(decimals) > 0 else None
        AST = to_float(decimals[3]) if len(decimals) > 3 else None
        REB = to_float(decimals[5]) if len(decimals) > 5 else None

        TS = clean_percent(percents[0]) if len(percents) > 0 else None

        # After TS% there is rTS% also percent; then TOV is a decimal next in stream.
        # We'll set TOV = decimals[6] usually (based on your format: ... REB, TS%, rTS%, TOV ...)
        TOV = to_float(decimals[6]) if len(decimals) > 6 else None

        TwoP = clean_percent(percents[2]) if len(percents) > 2 else None
        ThreeP = clean_percent(percents[3]) if len(percents) > 3 else None

        # 3PA is usually next decimal after 3P%
        ThreePA = to_float(decimals[8]) if len(decimals) > 8 else None

        FT = clean_percent(percents[4]) if len(percents) > 4 else None
        FTA = to_float(decimals[9]) if len(decimals) > 9 else None

        OREB = to_float(decimals[10]) if len(decimals) > 10 else None
        DREB = to_float(decimals[11]) if len(decimals) > 11 else None
        STL = to_float(decimals[12]) if len(decimals) > 12 else None
        BLK = to_float(decimals[13]) if len(decimals) > 13 else None

        players.append({
            "Team": team,
            "Player": name,
            "Position": pos,
            "MIN": MIN,
            "OnBall_pct": OnBall,
            "DPM": DPM,
            "ODPM": ODPM,
            "DDPM": DDPM,
            "PTS": PTS,
            "AST": AST,
            "REB": REB,
            "TS_pct": TS,
            "TOV": TOV,
            "TwoP_pct": TwoP,
            "ThreeP_pct": ThreeP,
            "ThreePA": ThreePA,
            "FT_pct": FT,
            "FTA": FTA,
            "OREB": OREB,
            "DREB": DREB,
            "STL": STL,
            "BLK": BLK,
        })

    return players

def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        raw = f.read()

    players = parse_players(raw)

    if not players:
        raise SystemExit("No players parsed. Check raw.txt format (team/name/team•pos blocks).")

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for p in players:
            w.writerow(p)

    print(f"OK: wrote {len(players)} rows to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()