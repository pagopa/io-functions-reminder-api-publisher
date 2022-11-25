/* eslint-disable @typescript-eslint/naming-convention */ // disabled in order to use the naming convention used to flatten nested object to root ('_' char used as nested object separator)
import { Context } from "@azure/functions";
import * as winston from "winston";

import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";

import { fromConfig } from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaTypes";
import * as express from "express";
import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";
import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { avroMessageFormatter } from "../utils/formatter/messagesAvroFormatter";
import { PostMessage } from "./handler";
import { getConfigOrThrow } from "../utils/config";

// eslint-disable-next-line functional/no-let
let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug",
});
winston.add(contextTransport);

const config = getConfigOrThrow();

const messagesConfig = {
  clientId: "REMINDER_TEST",
  brokers: [...config.MESSAGES_BROKERS],
  maxInFlightRequests: 1,
  idempotent: true,
  transactionalId: "IO_REMINDER_TEST",
  topic: config.MESSAGES_TOPIC,
};

const messageTopic = {
  ...messagesConfig,
  messageFormatter: avroMessageFormatter(),
};

const kafkaClient = fromConfig(
  messagesConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
  messageTopic
);

// Setup Express
const app = express();
secureExpressApp(app);

app.post("/api/v1/messages", PostMessage(kafkaClient));

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
function httpStart(context: Context): void {
  setAppContext(app, context);
  azureFunctionHandler(context);
}

export default httpStart;
