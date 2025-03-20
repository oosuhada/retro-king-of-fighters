export class SingleMatchState {
    constructor(choices) {
        this.teams = choices.map(team => [{ characterIndex: team[0], hp: 100, defeated: false }]);
        this.teamGauge = [{ power: 0, stocks: 0 }, { power: 0, stocks: 0 }];
        this.wins = [0, 0];
        this.round = 1;
    }

    activeMember(player) { return this.teams[player][0]; }
    gaugeFor(player) { return this.teamGauge[player]; }

    snapshot(players) {
        players.forEach((fighter, player) => {
            if (!fighter) return;
            this.teams[player][0].hp = fighter.hp;
            this.teamGauge[player] = { power: fighter.power, stocks: fighter.stocks };
        });
    }

    resolveRound(winner) {
        if (winner !== null) this.wins[winner] += 1;
        const matchOver = this.wins.some(value => value >= 2);
        const matchWinner = matchOver ? this.wins.findIndex(value => value >= 2) : null;
        if (!matchOver) {
            this.round += 1;
            this.teams[0][0].hp = 100;
            this.teams[1][0].hp = 100;
        }
        return { matchOver, matchWinner };
    }

    teamLabel(player) {
        return `${this.wins[player] > 0 ? '●' : '○'} ${this.wins[player] > 1 ? '●' : '○'}`;
    }
}
