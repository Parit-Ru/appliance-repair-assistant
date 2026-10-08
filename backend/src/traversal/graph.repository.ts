import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Pool, RowDataPacket } from 'mysql2/promise';

import { MYSQL_POOL } from '../database/database.constants';
import {
  DeviceCategory,
  Difficulty,
  InputType,
  NodeType,
  OutcomeKind,
  Severity,
  TroubleshootingGraph,
  TroubleshootingNode,
  UnsupportedSchemaVersionError,
} from '../traversal-engine/types';

interface GraphRow extends RowDataPacket {
  graph_id: string;
  manual_id: string;
  entry_symptom: string;
  entry_symptom_th: string | null;
  entry_symptom_aliases: unknown;
  source: string;
  page_start: number;
  page_end: number;
  source_chunk_id: string;
  severity: Severity | null;
  difficulty: Difficulty | null;
  config: unknown;
  entry_node: string;
  schema_version: number;
  device_category: DeviceCategory;
  brand: string;
  model_pattern: string;
}