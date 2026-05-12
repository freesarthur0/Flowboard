// CSS imports
import './styles/base.css';
import './styles/layout.css';
import './styles/mobile.css';
import './styles/components.css';
import './styles/reminders.css';
import './styles/timeline.css';

// Core
import './core/state';
import './core/utils';
import './core/config';
import './core/api';
import './features/auth'; // Injeta funções de autenticação globais

// UI
import './ui/ui';
import './ui/custom-dialogs';
import './ui/render-desktop';
import './ui/render-mobile';
import './ui/modal';

// Features
import './features/boards';
import './features/search';
import './features/reminders';
import './features/timeline';
import './features/notes';
import './features/realtime';
import './features/init';

console.log("FlowBoard App Initialized");
