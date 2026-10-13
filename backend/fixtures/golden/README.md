# Receipt reader golden set

Expected readings for `server/services/receipt-reader.ts`, checked live against the model by
`npm run eval:receipts`. Run it before and after every prompt or schema change.

## Images

Photos are **not** in git: receipts carry tax numbers, ETTN and document numbers. Put each photo in
`fixtures/golden/images/` (gitignored) under the file name given by the case's `image` field. A case
whose image is missing is reported as SKIPPED and makes the run fail. Ask the project owner for the photos.

## Adding a receipt

1. Copy the photo to `images/<name>.jpg` (JPEG, PNG or WebP, under ~500 KB so it fits the reader's upload limit).
2. Write `<name>.json` by reading the photo yourself. Never copy the model's output as the truth.

```json
{
  "description": "Store, photo conditions, what makes this receipt hard",
  "image": "images/<name>.jpg",
  "currency": "TRY",
  "total": 130.73,
  "items": [
    { "name": "SOGAN", "paidPrice": 64.23, "quantity": 1, "grams": 1170, "excluded": false, "health": "healthy", "fruitVeg": true }
  ]
}
```

Per item, in printed order:

| field | checked | meaning |
| --- | --- | --- |
| `name` | warning | name as printed; used to align expected and read items, a small misread is only a warning |
| `paidPrice` | exact | row amount minus that product's discount (`ÜRÜN İND.`), to the cent |
| `quantity` | exact | count from a `2 X 15,00` line; 1 for weighed or single products |
| `grams` | exact | weight from a kg line (`0,776 kg` = 776), otherwise 0 |
| `excluded` | exact | true for non-food (bags, hygiene, cleaning, cosmetics, tobacco) |
| `health` | warning, optional | `healthy` / `unhealthy` / `neutral`; set only when unambiguous |
| `alcohol` | warning, optional | `true` for alcoholic drinks (the reader must label them unhealthy) |
| `fruitVeg` | warning, optional | whether fresh fruit/veg grams are counted |

`total` and `currency` are exact. The runner refuses a case whose item prices do not add up to `total`.

## Running

```bash
npm run eval:receipts                    # every case once
npm run eval:receipts -- --runs 3        # 3 runs per case: shows run-to-run stability
npm run eval:receipts -- onur-market a101
```

Each run makes one paid model call per case (needs `OCR_API_KEY` in `backend/.env`), so it is manual
and not part of `npm test`. The report lists per run: PASS/FAIL, the reliability check, total, item count,
every exact mismatch (`x`) and judgement warning (`~`), latency, and with `--runs` > 1 which items read
differently between runs. Exit code is 1 on any exact failure. Raw readings are saved to `results/` (gitignored).
