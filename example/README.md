# @djpanda/convex-authz Example

Interactive demo application showcasing the authorization component.

## Features

- 📊 **Dashboard** - Overview of authorization stats and role definitions
- 👥 **Users & Roles** - Manage user role assignments interactively
- 🧪 **Permission Tester** - Test which permissions users have in different scopes

## Quick Start

1. **Install dependencies** (from root):

   ```bash
   npm install
   ```

2. **Seed demo data**:

   ```bash
   npx convex run seed:seedAll
   ```

3. **Start the dev server** (from root):

   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173)

## Demo Data

The seed script creates:

- **Organizations**: Acme Corp (enterprise), BetaCo (pro)
- **Users**:
  - Alice (admin @ Acme)
  - Bob (editor @ Acme)
  - Charlie (viewer @ Acme)
  - Diana (admin @ BetaCo)
  - Eve (editor @ BetaCo)
  - Frank (external user with explicit permission)
- **Documents**: Sample documents in each organization
- **Role Assignments**: RBAC roles scoped to organizations

## Commands

```bash
# Seed all demo data
npx convex run seed:seedAll

# Clear all demo data
npx convex run seed:clearAll
```

## Role Definitions

| Role          | Permissions                                              |
| ------------- | -------------------------------------------------------- |
| `admin`       | Full access to documents, settings, users, billing       |
| `editor`      | Create, read, update documents; view settings            |
| `viewer`      | Read-only access to documents and settings               |
| `billing_admin` | View and manage billing; view settings                  |

## Architecture

```
example/
├── convex/
│   ├── app.ts        # App queries and mutations
│   ├── constants.ts  # Demo data definitions
│   ├── schema.ts     # App tables (users, orgs, documents)
│   ├── seed.ts       # Seed script
│   └── example.ts    # Usage examples
├── src/
│   ├── components/
│   │   ├── app-sidebar.tsx
│   │   └── ui/       # shadcn/ui components
│   ├── pages/
│   │   ├── dashboard.tsx
│   │   ├── users.tsx
│   │   └── permission-tester.tsx
│   ├── lib/
│   │   └── utils.ts
│   ├── App.tsx
│   └── main.tsx
└── index.html
```

## Tech Stack

- [React](https://react.dev) - UI framework
- [Convex](https://convex.dev) - Backend
- [Tailwind CSS v4](https://tailwindcss.com) - Styling
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [Lucide](https://lucide.dev) - Icons
