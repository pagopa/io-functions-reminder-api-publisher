import * as express from "express";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";

import * as KP from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaProducerCompact";
import { NewMessage } from "@pagopa/io-functions-commons/dist/src/models/message";
import {
  withRequestMiddlewares,
  wrapRequestHandler,
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { Context } from "@azure/functions";
import {
  IResponseErrorInternal,
  IResponseSuccessAccepted,
  ResponseErrorInternal,
  ResponseSuccessAccepted,
} from "@pagopa/ts-commons/lib/responses";

export const PostMessageHandler = (
  client: KP.KafkaProducerCompact<NewMessage>
) => (
  _: Context,
  payload: NewMessage
): Promise<IResponseErrorInternal | IResponseSuccessAccepted<unknown>> =>
  pipe(
    [payload],
    KP.sendMessages(client),
    TE.mapLeft((failures) =>
      ResponseErrorInternal(failures.map((fail) => fail.message).join("|"))
    ),
    TE.map(() => ResponseSuccessAccepted("Accepted")),
    TE.toUnion
  )();

/**
 * Wraps a GetMessage handler inside an Express request handler.
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function PostMessage(
  client: KP.KafkaProducerCompact<NewMessage>
): express.RequestHandler {
  const handler = PostMessageHandler(client);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    RequiredBodyPayloadMiddleware(NewMessage)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
