Role: You are an Expert UI/UX Designer and Senior React/Tailwind Developer.

Context: I am building a Web3 Farming Game (code name: FarmHeist) playable as a Telegram Mini App. The core gameplay is inspired by the classic 2010s game "Barn Buddy" (see attached images for the original layout: Top HUD, Bottom Toolbars, Friend List, and Shop Popup).

Objective: Redesign the outdated, skeuomorphic flash-game UI of Barn Buddy into a modern, sleek, and mobile-first 2024 Web3 aesthetic. The underlying game will be rendered in a <canvas> (Phaser 3), so your job is to build the React UI Overlay that sits on top of the game canvas with pointer-events-none (allowing clicks to pass through to the game) and pointer-events-auto for the UI buttons.

Design System & Aesthetic Guidelines:

Style: Modern Web3 Mobile Game. Think "Glassmorphism" (semi-transparent blurred backgrounds to let the farm canvas show through), rounded corners (rounded-2xl), and clean spacing.

Colors: Vibrant but polished.

Primary: Soft Green (Nature/Farming)

Secondary: Amber/Gold (Coins/Tokens)

Web3 Accent: Crypto Blue/Purple for Wallet and NFT features.

Typography: Bold, readable on mobile screens (Telegram Webview).

Icons: Use lucide-react for all icons instead of custom images.

Required Components to Build (in a single App.tsx file for easy testing):

1. Top HUD (Heads-Up Display):

Left side: User Avatar (circle), Level Badge, and a Progress Bar.

Middle: Dual Currency display.

"GOLD" (Soft currency, yellow text/icon).

"$FARM" (Web3 Token, crypto-style badge).

Right side: "Connect Wallet" button (glassy effect) and a Settings icon.

2. Bottom Action Toolbar (Tools):

A floating, pill-shaped dock at the bottom center.

Icons needed: Cursor (Default), Trowel (Dig), Seeds, Watering Can, Bug Spray, and a Glove (Steal tool - highlight this one in red/orange as it's the core Web3 social mechanic).

Add a subtle active state (highlight/scale) for the selected tool.

3. Social/Friend Bar (Above the Action Toolbar):

A horizontal scrollable list of friends' avatars.

Include a "Steal/Visit" badge on avatars whose farms have harvestable crops.

4. Web3 Seed Shop Modal (Overlay):

Create a reusable Modal component for the Shop.

Grid layout for Seeds. Each seed card should show: Seed Name, Cost (in GOLD), Grow Time, and Expected ROI/Yield (crucial for Web3 tokenomics).

Close button (X) at the top right.

Technical Constraints:

Use purely functional React components.

Use Tailwind CSS for 100% of the styling.

Ensure the main container is h-screen w-full relative overflow-hidden.

Mock all state (e.g., activeTool, isShopOpen, goldBalance) using useState so the UI is fully interactive.

Output: Give me the complete, production-ready React code. Do not skip any CSS classes. Make it beautiful enough to pitch to Web3 angel investors.

💡 Lợi ích của Prompt này mang lại:
Chuyển đổi UI/UX mượt mà: Prompt yêu cầu Claude bỏ qua phong cách viền gỗ, bóng đổ giả thực (skeuomorphic) của năm 2010 trong ảnh, để chuyển sang phong cách Glassmorphism (Kính mờ). Điều này giúp lớp UI React nhìn rất hiện đại, không che khuất màn hình game nông trại bên dưới và cực kỳ phù hợp với trend của Telegram Mini App.

Định hình Tokenomics qua UI: Thay vì chỉ có 1 loại tiền (Coin) như Barn Buddy cũ, prompt ép Claude thiết kế ngay thanh Dual-Currency (Vàng Off-chain và Token $FARM On-chain) cùng nút Connect Wallet.

Tôn vinh tính năng cốt lõi: Công cụ "Găng tay ăn trộm" (Steal Tool) được chỉ định nhấn mạnh bằng màu sắc (highlight), giúp người chơi nhận diện ngay đây là tính năng quan trọng nhất của game.

Dễ dàng tích hợp: Claude sẽ dùng thư viện icon lucide-react (rất nhẹ và phổ biến), trả về một file React hoàn chỉnh. Bạn chỉ việc copy dán đè lên file App.tsx ở bước setup trước là sẽ có ngay một giao diện xịn sò bọc bên ngoài lớp logic trồng trọt.