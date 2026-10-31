# Posh Paws

Pet grooming platform. One repo, three independent apps, each with its own dependencies.

```
customer/   Angular: the customer website and booking flow   → http://localhost:4200
admin/      Angular: staff dashboard                         → http://localhost:4300
backend/    Python FastAPI: REST API for both front-ends     → http://localhost:8000/api
```

```
  customer (Angular)      admin (Angular)
          │                      │
          └──── HTTPS · JSON ────┘
                     ▼
            backend (FastAPI)  ──►  database
```

## Run locally

Open a terminal per app.

```bash
# Customer app
cd customer
npm install
npm start

# Admin app (demo login: meera@poshpaws.in / pawsword)
cd admin
npm install
npm start

# Backend API
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload     # API docs at http://localhost:8000/docs
```

Each app's own README has the details.

## Deploy

`netlify.toml` builds and deploys the customer app from `customer/`.
