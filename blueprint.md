# Lotto 6/45 Web Application Blueprint

## Overview
This application is a modern, framework-less web implementation of the Lotto 6/45 game. It allows users to select lottery numbers manually or automatically, manage a shopping cart of up to 100 games, and "purchase" them using a virtual point system.

## Project Structure & Architecture
- **Framework-less Architecture:** Built using native Web Components (ES Modules) for encapsulation and reusability.
- **State Management:** A central `AppManager` handles the global state for user points and the shopping cart, facilitating communication between components via custom events.
- **Design System:** Utilizes modern CSS features including CSS Variables, Grid/Flexbox, and `:has()` selector for a responsive and visually rich UI.

## Components
- **`lotto-header`**: Manages the top navigation, branding, and real-time point display. Updates based on auth state.
- **`lotto-auth`**: A modal component for user registration and login.
- **`lotto-selector`**: The primary interface for number selection. Includes a 5x9 grid and intelligent auto-fill.
- **`lotto-cart`**: Displays the current selection of games in 5 fixed slots (A-E).

## Features & Business Logic
- **Authentication:** LocalStorage-based signup/login (ID, PW, optional Email).
- **Point Rewards:**
  - **Signup Bonus:** 100,000 pts.
  - **Daily Login Bonus:** 200,000 pts (once per day).
  - **Inactivity Penalty:** No bonus if the last login was more than 7 days ago.
- **Game Cost:** 1,000 pts per game.
- **Selection:** Manual selection with 5x9 grid + partial auto-fill support.

## Design & UI/UX
- **Aesthetics:** Card-based layout with soft shadows and interactive hover effects.
- **Colors:** A vibrant palette with professional blues and energetic accent colors.
- **Responsive:** Fluid layout that adapts to mobile and desktop viewports using CSS Grid and media queries.
- **Accessibility:** Semantic HTML and clear interactive states.

## Current Plan: Initial Development
1. Initialize core files (`index.html`, `style.css`, `main.js`).
2. Implement `AppManager` and Web Components.
3. Integrate styling and verify responsiveness.
4. Finalize functionality and push to GitHub.
