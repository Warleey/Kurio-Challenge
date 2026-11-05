import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { socketIoHandler } from './socket-handlers';

export const worker = setupWorker(...handlers, socketIoHandler);
