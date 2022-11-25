/* eslint-disable sort-keys */
/* eslint-disable functional/immutable-data */
import { Context } from "@azure/functions";
import * as KP from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaProducerCompact";
import { constVoid, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as express from "express";
import {
  ContextMiddleware,
  setAppContext
} from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";
import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { withRequestMiddlewares } from "@pagopa/ts-commons/lib/request_middleware";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import {
  RetrievedMessage,
  RetrievedMessageWithContent
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { message as avroMessage } from "../generated/avro/dto/message";
import * as avro from "avsc";
import { MessageContentType } from "../generated/avro/dto/MessageContentTypeEnum";
import { FeatureLevelType } from "../generated/avro/dto/FeatureLevelTypeEnum";
import { MessageFormatter } from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaTypes";

export const buildAvroMessagesObject = (
  retrievedMessage: RetrievedMessage
): Omit<avroMessage, "schema" | "subject"> => {
  const messageContent = RetrievedMessageWithContent.is(retrievedMessage)
    ? retrievedMessage.content
    : undefined;
  const paymentData = messageContent?.payment_data;

  return {
    content_paymentData_amount: paymentData?.amount ?? 0,
    content_paymentData_invalidAfterDueDate:
      paymentData?.invalid_after_due_date ?? false,
    content_paymentData_noticeNumber: paymentData?.notice_number ?? "",
    content_paymentData_payeeFiscalCode: "",
    content_subject: RetrievedMessageWithContent.is(retrievedMessage)
      ? retrievedMessage.content.subject
      : "",
    content_type: RetrievedMessageWithContent.is(retrievedMessage)
      ? retrievedMessage.content.payment_data
        ? MessageContentType.PAYMENT
        : MessageContentType.GENERIC
      : null,
    createdAt: retrievedMessage.createdAt.getTime(),
    dueDate: messageContent?.due_date?.getTime() ?? 0,
    feature_level_type: FeatureLevelType.ADVANCED,
    fiscalCode: retrievedMessage.fiscalCode,
    id: retrievedMessage.id,
    isPending:
      retrievedMessage.isPending === undefined
        ? true
        : retrievedMessage.isPending,
    senderServiceId: retrievedMessage.senderServiceId,
    senderUserId: retrievedMessage.senderUserId,

    timeToLiveSeconds: retrievedMessage.timeToLiveSeconds
  };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const avroMessageFormatter = (): MessageFormatter<RetrievedMessage> => message => ({
  key: message.id,
  value: avro.Type.forSchema(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    avroMessage.schema as avro.Schema // cast due to tsc can not proper recognize object as avro.Schema (eg. if you use const schemaServices: avro.Type = JSON.parse(JSON.stringify(services.schema())); it will loose the object type and it will work fine)
  ).toBuffer(Object.assign(new avroMessage(), buildAvroMessagesObject(message)))
});

const DEF_CONFIG = {
  clientId: "IO_FUNCTIONS_ELT",
  brokers: ["localhost:9094"],
  maxInFlightRequests: 1,
  idempotent: true,
  transactionalId: "IO_ELT",
  topic: "test",
  messageFormatter: avroMessageFormatter()
};
const producer = KP.fromConfig(DEF_CONFIG, DEF_CONFIG);

const app = express();
app.post("/reminder/messages");

export const handleMessageChange = () => (
  document: RetrievedMessage
): Promise<IResponseSuccessJson<void> | IResponseErrorInternal> =>
  pipe(
    [document],
    KP.sendMessages(producer),
    TE.map(constVoid),
    TE.map(ResponseSuccessJson),
    TE.mapLeft(_ => ResponseErrorInternal("something gone wrong!")),
    TE.toUnion
  )();

const run = async (
  context: Context
): Promise<Failure | IBulkOperationResult> => {
  return handleMessageChange(kafkaClient)(documents);
};

export default run;
