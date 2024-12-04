// server/room/Room.js
class Room {
    constructor(id) {
        this.id = id;
        this.players = new Map();
        this.isGameStarted = false;
        this.settings = {};
    }

    isOwner(playerId) {
        const player = this.players.get(playerId);
        return player?.isOwner || false;
    }

    // Méthodes existantes...
}

export default Room;