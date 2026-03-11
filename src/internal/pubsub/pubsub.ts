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
                if(err){
                    reject(err);
                } else {
                    resolve();
                }
            }
        )
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

    await newConn.bindQueue(queueName, exchange, key, queue);

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
    const [channel, queue] = await declareAndBind(conn, exchange, queueName, key, queueType);
    channel.consume(queue.queue, async (message) => {
        if(!message) return;
        const parseMessage = JSON.parse(message.content.toString());
        const ackType = await handler(parseMessage);
        switch(ackType){
            case AckType.Ack:
                console.log("Message Acknowledge");
                channel.ack(message);
                break;
            case AckType.NackRequeue:
                console.log("Message Not Acknowledge; Requeueing");
                channel.nack(message, false, true);
                break;
            case AckType.NackDiscard:
                console.log("Message Not Acknowledge; Discarding");
                channel.nack(message, false, false);
                break;
        }
    });
}