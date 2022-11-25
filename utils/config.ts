/**
 * Config module
 *
 * Single point of access for the application confguration. Handles validation on required environment variables.
 * The configuration is evaluate eagerly at the first access to the module. The module exposes convenient methods to access such value.
 */

import * as t from "io-ts";

import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as R from "fp-ts/Record";
import * as S from "fp-ts/string";
import { set } from "lodash";

import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { KafkaProducerCompactConfig } from "@pagopa/fp-ts-kafkajs/dist/lib/IoKafkaTypes";
import { CommaSeparatedListOf } from "./types";

// global app configuration
export type IConfig = t.TypeOf<typeof IConfig>;
// eslint-disable-next-line @typescript-eslint/ban-types
export const IConfig = t.interface({
  MESSAGES_BROKERS: CommaSeparatedListOf(NonEmptyString),
  MESSAGES_TOPIC: NonEmptyString,

  PN_SERVICE_ID: NonEmptyString,
  QueueStorageConnection: NonEmptyString,

  isProduction: t.boolean,
});

export const envConfig = {
  ...process.env,
  isProduction: process.env.NODE_ENV === "production",
};

console.log("ENV CONFIG");
console.log(envConfig);

// No need to re-evaluate this object for each call
const errorOrConfig: t.Validation<IConfig> = IConfig.decode(envConfig);

/**
 * Read the application configuration and check for invalid values.
 * Configuration is eagerly evalued when the application starts.
 *
 * @returns either the configuration values or a list of validation errors
 */
export const getConfig = (): t.Validation<IConfig> => errorOrConfig;

/**
 * Read the application configuration and check for invalid values.
 * If the application is not valid, raises an exception.
 *
 * @returns the configuration values
 * @throws validation errors found while parsing the application configuration
 */
export const getConfigOrThrow = (): IConfig =>
  pipe(
    errorOrConfig,
    E.getOrElseW((errors: ReadonlyArray<t.ValidationError>) => {
      throw new Error(`Invalid configuration: ${readableReport(errors)}`);
    })
  );
