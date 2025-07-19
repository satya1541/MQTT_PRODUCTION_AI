// Completely suppress all console logging FIRST - before any imports
const noop = () => {};

// Create a comprehensive console suppression
const suppressConsole = () => {
  const methods = ['log', 'error', 'warn', 'info', 'debug', 'trace', 'table', 'group', 'groupEnd', 'groupCollapsed', 'clear', 'count', 'countReset', 'time', 'timeEnd', 'timeLog', 'assert', 'dir', 'dirxml'];
  
  methods.forEach(method => {
    if (console[method]) {
      console[method] = noop;
    }
  });
  
  // Override console entirely
  Object.defineProperty(window, 'console', {
    value: new Proxy(console, {
      get() { return noop; }
    }),
    writable: false
  });
};

// Apply console suppression immediately
suppressConsole();

// Suppress global errors and promises
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  event.preventDefault();
});

// Now safe to import React and other modules
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import 'azure-maps-control/dist/atlas.min.css';

// Suppress Vite HMR and WebSocket related console messages
const originalAddEventListener = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function(type, listener, options) {
  if (typeof listener === 'function') {
    const wrappedListener = function(...args) {
      try {
        return listener.apply(this, args);
      } catch (error) {
        // Silently catch and suppress errors
      }
    };
    return originalAddEventListener.call(this, type, wrappedListener, options);
  }
  return originalAddEventListener.call(this, type, listener, options);
};

// Suppress WebSocket connection messages
const originalWebSocket = window.WebSocket;
window.WebSocket = class extends originalWebSocket {
  constructor(url, protocols) {
    super(url, protocols);
    
    // Override all WebSocket event handlers to suppress console output
    this.addEventListener = function(type, listener, options) {
      if (typeof listener === 'function') {
        const wrappedListener = function(...args) {
          try {
            return listener.apply(this, args);
          } catch (error) {
            // Silently suppress WebSocket errors
          }
        };
        return originalAddEventListener.call(this, type, wrappedListener, options);
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
  }
};

// Intercept and suppress Vite HMR console messages
if (import.meta.hot) {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Override console methods to filter out Vite messages
  console.log = function(...args) {
    const message = args.join(' ');
    if (message.includes('[vite]') || message.includes('connecting...') || message.includes('WebSocket')) {
      return;
    }
    return noop();
  };
  
  console.error = function(...args) {
    const message = args.join(' ');
    if (message.includes('WebSocket') || message.includes('Failed to construct') || message.includes('SyntaxError')) {
      return;
    }
    return noop();
  };
  
  console.warn = function(...args) {
    const message = args.join(' ');
    if (message.includes('WebSocket') || message.includes('[vite]')) {
      return;
    }
    return noop();
  };
}

// Suppress additional browser warnings
const originalWarn = window.console.warn;
window.console.warn = function(...args) {
  const message = args.join(' ');
  if (message.includes('Download the React DevTools') || 
      message.includes('autocomplete') || 
      message.includes('ResizeObserver') ||
      message.includes('WebSocket')) {
    return;
  }
  return noop();
};

// Add global building animation to body
document.addEventListener('DOMContentLoaded', () => {
  // Create the global building animation container
  const animationContainer = document.createElement('div');
  animationContainer.id = 'global-building-animation';
  animationContainer.className = 'building-animation-container';
  animationContainer.innerHTML = `
    <svg width="68" height="66" viewBox="0 0 68 66" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g id="art">
        <mask id="mask0" mask-type="alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="68" height="66">
          <rect id="mask" width="68" height="66" fill="#C4C4C4"/>
        </mask>
        <g mask="url(#mask0)">
          <g id="composition">
            <rect id="background" x="2" y="2" width="64" height="64" fill="#A8DADC"/>
            <g id="cloud_left">
              <path id="cloud_left_2" d="M8 30C8 30.0422 7.99951 30.0844 7.99866 30.1264C8.31873 30.0439 8.65417 30 9 30C11.2091 30 13 31.7909 13 34C13 36.2091 11.2091 38 9 38H-4.5C-6.98523 38 -9 35.9853 -9 33.5C-9 31.0147 -6.98523 29 -4.5 29C-4.30457 29 -4.11194 29.0125 -3.9231 29.0367C-3.46216 26.1809 -0.98584 24 2 24C5.31372 24 8 26.6863 8 30Z" fill="#F1FAEE"/>
            </g>
            <g id="cloud_right">
              <path id="cloud_right_2" d="M77 10C77 10.0422 76.9995 10.0844 76.9987 10.1264C77.3187 10.0439 77.6542 10 78 10C80.2091 10 82 11.7909 82 14C82 16.2091 80.2091 18 78 18H64.5C62.0148 18 60 15.9853 60 13.5C60 11.0147 62.0148 9 64.5 9C64.6954 9 64.8881 9.01248 65.0769 9.03665C65.5378 6.18091 68.0142 4 71 4C74.3137 4 77 6.68628 77 10Z" fill="#F1FAEE"/>
            </g>
            <g id="building_top">
              <path id="Rectangle 425" d="M16 17H52V47H16V17Z" fill="#F1FAEE"/>
              <path id="Rectangle 425 (Stroke)" fill-rule="evenodd" clip-rule="evenodd" d="M15 17C15 16.4477 15.4477 16 16 16H52C52.5523 16 53 16.4477 53 17V47C53 47.5523 52.5523 48 52 48H16C15.4477 48 15 47.5523 15 47V17ZM17 18V46H51V18H17Z" fill="#1D3557"/>
              <path id="Rectangle 426" d="M14 13H54V17H14V13Z" fill="#457B9D"/>
              <path id="Rectangle 426 (Stroke)" fill-rule="evenodd" clip-rule="evenodd" d="M13 13C13 12.4477 13.4477 12 14 12H54C54.5523 12 55 12.4477 55 13V17C55 17.5523 54.5523 18 54 18H14C13.4477 18 13 17.5523 13 17V13ZM15 14V16H53V14H15Z" fill="#1D3557"/>
            </g>
            <g id="building_bottom">
              <path id="Rectangle 423" d="M15 47H53V51H15V47Z" fill="#457B9D"/>
              <path id="Rectangle 423 (Stroke)" fill-rule="evenodd" clip-rule="evenodd" d="M14 47C14 46.4477 14.4477 46 15 46H53C53.5523 46 54 46.4477 54 47V51C54 51.5523 53.5523 52 53 52H15C14.4477 52 14 51.5523 14 51V47ZM16 48V50H52V48H16Z" fill="#1D3557"/>
              <path id="Rectangle 424" d="M16 51H52V65H16V51Z" fill="#F1FAEE"/>
              <path id="Rectangle 424 (Stroke)" fill-rule="evenodd" clip-rule="evenodd" d="M15 51C15 50.4477 15.4477 50 16 50H52C52.5523 50 53 50.4477 53 51V65C53 65.5523 52.5523 66 52 66H16C15.4477 66 15 65.5523 15 65V51ZM17 52V64H51V52H17Z" fill="#1D3557"/>
            </g>
            <rect id="frame" x="1" y="1" width="66" height="64" stroke="#1D3557" stroke-width="2" stroke-linejoin="round"/>
          </g>
        </g>
      </g>
    </svg>
  `;
  document.body.appendChild(animationContainer);
});

createRoot(document.getElementById("root")!).render(<App />);
