# Day 4: Setup React for UI Components

## Objective
Set up React in the UI package for portal and demo components.

## Steps
1. In packages/ui: `cd packages/ui`
2. Install React: `npm install react react-dom`
3. Install dev tools: `npm install --save-dev @types/react @types/react-dom typescript react-scripts`

## Updated packages/ui/package.json
```json
{
  "name": "@ableka-lumina/ui",
  "version": "1.0.0",
  "description": "UI package",
  "main": "src/index.tsx",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.15",
    "@types/react-dom": "^18.2.7",
    "typescript": "^5.1.6",
    "react-scripts": "5.0.1"
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  }
}
```

## Basic App (src/App.tsx)
```tsx
import React from 'react';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Ableka Lumina Portal</h1>
        <p>AI-Driven Compliance</p>
      </header>
    </div>
  );
}

export default App;
```

## src/index.tsx
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## public/index.html
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Ableka Lumina</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
```

## Verification
- Run `npm start` to launch React app on localhost:3000.

## Notes
- Basic setup; add components for portal in later weeks.