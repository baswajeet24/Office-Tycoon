# Office-Tycoon
# OOPS Course Project: Office Tycoon

## 🎮 Project Overview
This is a 2D simulation game built using **Phaser 3** and **JavaScript**. The goal is to demonstrate **Object-Oriented Programming (OOP)** concepts through a game where you manage a software company.

You control a CEO and 4 Managers. Your objective is to manage the company's capital, hire employees for specific projects, and ensure project progress reaches 100% while paying salaries.

## 🕹️ Gameplay Mechanics
- **The Company**: Starts with $10,000 capital. Every 10 seconds, salaries are deducted based on total employee count.
- **Managers**: There are 4 managers, each leading a different department (AI, Security, Data, UI).
- **Hiring/Firing**: Managers can enter specific zones to hire staff (costs money) or fire staff (reduces costs).
- **Synergy**: If two managers meet in the **Cafeteria**, their teams work faster due to collaboration.
- **The Boss**: Can walk around to "Audit" managers (check their specific stats) or visit the Stats Room for a company-wide overview.

## 🛠️ Technical Implementation (OOP Concepts)
This project maps game logic directly to OOP principles:
1.  **Inheritance**: `Manager` and `Boss` classes inherit from a base `Person` class (which inherits from Phaser Sprites).
2.  **Encapsulation**: Managers have private properties like `_team` and `_projectProgress` that are managed internally.
3.  **Static Members**: The `Company` class uses static properties for global state (Capital, Total Employees) accessible by all instances.
4.  **Polymorphism**: Different characters interact differently with zones (e.g., only Managers can Hire/Fire).

## How to Run
Because of browser security policies regarding loading local images, you cannot simply double-click `index.html`.

1. Open this folder in **VS Code**.
2. Install the **Live Server** extension (by Ritwick Dey).
3. Right-click `index.html` and select **"Open with Live Server"**.

## Controls
- **WASD**: Move Character
- **1-5**: Switch active character (1=Boss, 2-5=Managers)
- **H**: Hire staff (Must be in Hiring Zone)
- **X**: Fire staff (Must be in Firing Zone)
- **S**: Save Game Data

## Project Structure
- `game.js`: Contains the Class hierarchy (Company, Person, Manager, Boss) and game logic.
- `index.html`: The web entry point.
- `assets/`: Folder containing sprites and maps.
