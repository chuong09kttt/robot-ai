import { BaseGame } from './BaseGame.js';

export class BoatGame extends BaseGame {
    constructor(canvasId) {
        super(canvasId, { lives: 5, speedIcon: '🚤' });
    }
}
