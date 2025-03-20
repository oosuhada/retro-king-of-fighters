export class TeamMatchState {
    constructor(teamChoices) {
        this.teams = teamChoices.map(team => team.map(characterIndex => ({
            characterIndex,
            hp: 100,
            defeated: false,
        })));
        // KOF meter belongs to the player side, not to an individual team member.
        // A defeated fighter therefore hands the accumulated gauge to the next fighter.
        this.teamGauge = [
            { power: 0, stocks: 0 },
            { power: 0, stocks: 0 },
        ];
        this.activeIndex = [0, 0];
        this.round = 1;
    }

    activeMember(player) {
        return this.teams[player][this.activeIndex[player]] || null;
    }

    gaugeFor(player) {
        return this.teamGauge[player];
    }

    snapshot(players) {
        players.forEach((fighter, player) => {
            const member = this.activeMember(player);
            if (!member || !fighter) return;
            member.hp = fighter.hp;
            this.teamGauge[player] = {
                power: fighter.power,
                stocks: fighter.stocks,
            };
        });
    }

    recoveryForTime(timeLeftMs) {
        const seconds = Math.max(0, Math.floor(timeLeftMs / 1000));
        return Math.max(8, Math.min(24, 8 + Math.floor(seconds / 4)));
    }

    eliminate(player) {
        const member = this.activeMember(player);
        if (member) {
            member.defeated = true;
            member.hp = 0;
        }
        this.activeIndex[player] += 1;
    }

    resolveRound(winner, timeLeftMs) {
        if (winner === null) {
            this.eliminate(0);
            this.eliminate(1);
        } else {
            const loser = 1 - winner;
            this.eliminate(loser);
            const winnerMember = this.activeMember(winner);
            if (winnerMember) {
                winnerMember.hp = Math.min(100, winnerMember.hp + this.recoveryForTime(timeLeftMs));
            }
        }

        const player0Alive = this.activeIndex[0] < this.teams[0].length;
        const player1Alive = this.activeIndex[1] < this.teams[1].length;
        const matchOver = !player0Alive || !player1Alive;
        let matchWinner = null;
        if (matchOver && player0Alive !== player1Alive) matchWinner = player0Alive ? 0 : 1;

        if (!matchOver) this.round += 1;
        return { matchOver, matchWinner };
    }

    teamLabel(player, characterName) {
        return this.teams[player]
            .map((member, index) => {
                const name = characterName(member.characterIndex);
                if (member.defeated) return `×${name}`;
                if (index === this.activeIndex[player]) return `▶${name}`;
                return `○${name}`;
            })
            .join('  ');
    }
}
