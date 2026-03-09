import amqp from "amqplib";
import type { ConfirmChannel } from "amqplib";

export enum SimpleQueueType{
    Durable,
    Transient,
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
        autoDelete: autoDelete
    };
    
    const queue = await newConn.assertQueue(queueName, queueOptions);

    await newConn.bindQueue(queueName, exchange, key, queue);

    return [newConn, queue];
}