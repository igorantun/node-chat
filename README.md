Node.JS Chat
============
[![GitHub Stars](https://img.shields.io/github/stars/IgorAntun/node-chat.svg)](https://github.com/IgorAntun/node-chat/stargazers) [![GitHub Issues](https://img.shields.io/github/issues/IgorAntun/node-chat.svg)](https://github.com/IgorAntun/node-chat/issues) [![Current Version](https://img.shields.io/badge/version-0.21.9-green.svg)](https://github.com/IgorAntun/node-chat) [![Live Demo](https://img.shields.io/badge/demo-online-green.svg)](http://igorantun.com/chat) " [![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/IgorAntun/node-chat?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

This is a node.js chat application powered by SockJS and Express that provides the main functions you'd expect from a chat, such as emojis, private messages, an admin system, etc.

![Chat Preview](http://i.imgur.com/lgRe8z4.png)

## Demo
You can test a fully working live demo at http://igorantun.com/chat
- Type `/help` to get a list of the available chat commands

## Features
- Emoji support
- User @mentioning
- Private messaging
- Message deleting (for admins)
- Ability to kick/ban users (for admins)
- [Other awesome features yet to be implemented](https://github.com/IgorAntun/node-chat/blob/master/TODO.md)

#### User Features
![User Features](http://i.imgur.com/WbF1fi2.png)

#### Admin Features
![Admin Features](http://i.imgur.com/xQFaadt.png)


## Setup
Clone this repo to your desktop and run `npm install` to install all the dependencies.

You might want to look into `app.js` and `public/js/chat.js` to make some adjustments such as changing the socket url to other than localhost, and set up a SSL certificate to work with it.

## Usage
After you clone this repo to your desktop, go to its root directory and run `npm install` to install its dependencies.

Once the dependencies are installed, you can run  `node main.js` to start the application. You will then be able to access it at http://localhost:3000

To give yourself administrator permissions on the chat, you will have to type `/op [your-name]` in the app console.

