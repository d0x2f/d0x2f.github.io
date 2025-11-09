+++
title = "PostgreSQL Physical Replication 101"
description = "A guide on everything you need to get up to speed on physical replication in PostgreSQL"
date = "2025-11-12"

[taxonomies]
tags = [
  "postgres",
  "postgresql",
  "database",
  "replication",
  "physical replication",
  "wal",
  "wal streaming"
]

[extra]
author = "Dylan McGannon"
x_handle = "@D0x2f"

+++

## Brief

This article aims to explain the way in which PostgreSQL achieves
physical replication, which is a type of replication supported by
PostgreSQL in which physical changes to on-disk data are replicated
from a primary node to replicas.

Logical replication is another type by which the **intent** of changes
are replicated rather than the disk level data differences, which
allows replication to other databases or instances that aren't
necessarily organised in the same way (e.g. replicating only one table
to a completely different database).

##
