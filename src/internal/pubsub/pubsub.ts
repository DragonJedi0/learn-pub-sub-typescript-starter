import { decode, encode } from "@msgpack/msgpack";
import amqp from "amqplib";
import type { ConfirmChannel } from "amqplib";

export enum SimpleQueueType{
    Durable,
    Transient,
}

export enum AckType {
    Ack,
    NackRequeue,
    NackDiscard,
}

export async function publishJSON<T>(
    ch: ConfirmChannel,
    exchange: string,
    routingKey: string,
    value: T,
): Promise<void> {
    const content = Buffer.from(JSON.stringify(value));
    return new Promise((resolve, reject) => {
        ch.publish(
            exchange,
            routingKey,
            content,
            { contentType: "application/json" },
            (err) => {
                if(err !== null){
                    reject(new Error("Message was NACKed by the broker"));
                } else {
                    resolve();
                }
            },
        );
    });
}

export function publishMsgPack<T>(ch: ConfirmChannel, exchange: string, routingKey: string, value: T): Promise<void> {
    const content = Buffer.from(encode(value));
    return new Promise((resolve, reject) => {
        ch.publish(
            exchange,
            routingKey,
            content,
            { contentType: "application/x-msgpack" },
            (err) => {
                if(err !== null){
                    reject(new Error("Message was NACKed by the broker"));
                } else {
                    resolve();
                }
            },
        );
    });
}

export async function declareAndBind(
    conn: amqp.ChannelModel,
    exchange: string,
    queueName: string,
    key: string,
    queueType: SimpleQueueType,
): Promise<[amqp.Channel, amqp.Replies.AssertQueue]> {
    const newConn = await conn.createChannel();

    const durable = queueType == SimpleQueueType.Durable ? true : false;
    const autoDelete = queueType == SimpleQueueType.Transient ? true : false;
    const exclusive = queueType == SimpleQueueType.Transient ? true : false;

    const queueOptions = {
        exclusive: exclusive,
        durable: durable,
        autoDelete: autoDelete,
        arguments: {
            "x-dead-letter-exchange": "peril_dlx",
        }
    };
    
    const queue = await newConn.assertQueue(queueName, queueOptions);

    await newConn.bindQueue(queue.queue, exchange, key, queue);

    return [newConn, queue];
}

export async function subscribeJSON<T>(
    conn: amqp.ChannelModel,
    exchange: string,
    queueName: string,
    key: string,
    queueType: SimpleQueueType,
    handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
    return subscribe(conn, exchange, queueName, key, queueType, handler, (message: Buffer) => {
        return JSON.parse(message.toString());
    })
}

export async function subscribeMsgPack<T>(
    conn: amqp.ChannelModel,
    exchange: string,
    queueName: string,
    key: string,
    queueType: SimpleQueueType,
    handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
    return subscribe(conn, exchange, queueName, key, queueType, handler, (message: Buffer) => {
        return decode(message) as T;
    });
}

export async function subscribe<T>(
    conn: amqp.ChannelModel,
    exchange: string,
    queueName: string,
    routingKey: string,
    simpleQueueType: SimpleQueueType,
    handler: (data: T) => Promise<AckType> | AckType,
    deserializer: (data: Buffer) => T,
): Promise<void> {
    const [channel, queue] = await declareAndBind(conn, exchange, queueName, routingKey, simpleQueueType);
    await channel.prefetch(10);
    channel.consume(queue.queue, async (message) => {
        if(!message) return;
        const parseMessage = deserializer(message.content);
        const ackType = await handler(parseMessage);
        switch(ackType){
            case AckType.Ack:
                channel.ack(message);
                break;
            case AckType.NackRequeue:
                channel.nack(message, false, true);
                break;
            case AckType.NackDiscard:
                channel.nack(message, false, false);
                break;
        }
    });
}