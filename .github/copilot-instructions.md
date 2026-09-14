# Gaming Solutions

- Backend: Node.js, Express and `node-oracledb`.
- Database: Oracle Database; keep SQL identifiers and comments in Spanish.
- Frontend: vanilla HTML, CSS and JavaScript in `public/`.
- Never commit `.env`, credentials, wallet files or generated dependencies.
- Keep API queries parameterized and release Oracle connections in `finally` blocks.
- Validate changes with `npm run check` and the demo mode (`DEMO_MODE=true npm start`) when Oracle is unavailable.
