import type { ArmyMove, RecognitionOfWar } from "../internal/gamelogic/gamedata.js";
import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { AckType, publishJSON } from "../internal/pubsub/pubsub.js";
import { type ConfirmChannel } from "amqplib";
import { ExchangePerilTopic, WarRecognitionsPrefix } from "../internal/routing/routing.js";
import { handleWar, WarOutcome } from "../internal/gamelogic/war.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
    return (ps: PlayingState) => {
        handlePause(gs, ps);
        process.stdout.write("> ");
        return AckType.Ack;
    };
}

export function handlerMove(gs: GameState, ch: ConfirmChannel): (move: ArmyMove) => Promise<AckType> {
    return async (move) => {
        const outcome = handleMove(gs, move);
        process.stdout.write("> ");
        if(outcome == MoveOutcome.Safe){
            return AckType.Ack;
        } else if (outcome == MoveOutcome.MakeWar){
            const username = gs.getPlayerSnap().username;
            const rw: RecognitionOfWar = {
                attacker: move.player,
                defender: gs.getPlayerSnap(),
            };
            await publishJSON(ch, ExchangePerilTopic, `${WarRecognitionsPrefix}.${username}`, rw);
            return AckType.NackRequeue;
        }
        return AckType.NackDiscard;
    }
}

export function handlerWar(gs: GameState): (war: RecognitionOfWar) => Promise<AckType> {
    return async (war) =>{
        const outcome = handleWar(gs, war);
        process.stdout.write("> ");
        switch(outcome.result){
            case WarOutcome.NotInvolved:
                return AckType.NackRequeue;
            case WarOutcome.NoUnits:
                return AckType.NackDiscard;
            case WarOutcome.OpponentWon:
                return AckType.Ack;
            case WarOutcome.YouWon:
                return AckType.Ack;
            case WarOutcome.Draw:
                return AckType.Ack;
            default:
                console.log("An Error occured");
                return AckType.NackDiscard;
        }
    }
}