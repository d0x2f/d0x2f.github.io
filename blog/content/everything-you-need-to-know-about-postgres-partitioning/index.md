+++
title = "Everything You Need to Know About PostgreSQL Partitioning"
description = "A guide on everything you need to get up to speed on partitioning in PostgreSQL"
date = "2025-05-26"

[taxonomies]
tags = ["postgres", "partman", "database", "partitioning"]

[extra]
author = "Dylan McGannon"
x_handle = "@D0x2f"

[[extra.images]]
path = "everything-you-need-to-know-about-postgres-partitioning/banner.png"
alt = "Title image "
+++

## What is Partitioning?

Partitioning, in a nutshell, is splitting one large table into multiple
smaller tables while transparently allowing usage as if it were a
single table. Each partition is independent in terms of storage and has
it's own indexes, they are just like any other table other than their
status as a partition. A group of partitions is referred to
collectively as the "partitioned table".

## Why use Partitions?

Partitions come with many advantages in PostgreSQL:

- Query performance is often dramatically improved if relevant indexes
  can be loaded into memory. Having smaller tables and indexes makes
  this much more likely.
- Furthermore, for some queries, it may even be faster to perform a
  sequence scan instead of using an index at all, which is made
  possible if partitions are small enough.
- For queries that touch multiple partitions, operations for each can
  be done in parallel, giving a speed boost.
- Some types of bulk operations are much easier to perform, such as
  bulk deletes, which can be designed as dropping partitions wholesale
  using `DROP TABLE ...` or by detaching the partition.
- It keeps vacuum operations less intensive and allows what would
  otherwise be a single large (potentially disruptive) vacuum to be
  performed in smaller chunks (i.e. for each partition).

## Types of Partitioning

As of PostgreSQL 17, there are three built-in partitioning types,
`range`, `list` and `hash`.

### Range

Range partitioning is the most common in my experience. It refers to
partitioning by key values within specific ranges, usually a date. So
for example you might have an `invoice` table partitioned by
`created_at`, where partitions are created for each day. You would
create such a partitioned table like so:

```sql
CREATE TABLE invoice (
  uuid UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT now()
) PARTITION BY RANGE (created_at);

CREATE TABLE invoice_2025_05_26
  PARTITION OF invoice
  FOR VALUES FROM ('2025-05-26') TO ('2025-05-27');
```

This type of partitioning is useful for time series data. It lets you
easily drop, archive or seal old data since they're neatly contained
into partitions.

### List

List partitioning is much more explicit, where you create partitions
for specific values of the partitioning key. You might use this to
partition an invoice table by status, for example.

```sql
CREATE TYPE invoice_status AS ENUM ('created', 'paid', 'cancelled');

CREATE TABLE invoice (
  uuid UUID DEFAULT gen_random_uuid(),
  status invoice_status NOT NULL,
  created_at TIMESTAMP DEFAULT now()
) PARTITION BY LIST (status);

CREATE TABLE invoice_created
  PARTITION OF invoice
  FOR VALUES IN ('created');

CREATE TABLE invoice_paid
  PARTITION OF invoice
  FOR VALUES IN ('paid');

CREATE TABLE invoice_cancelled
  PARTITION OF invoice
  FOR VALUES IN ('cancelled');
```

Partitioning using the list type is useful for splitting data into sets
that are normally queried in isolation from each other. In our example,
we might often query for value of unpaid invoices, or number of paid
invoices per month etc. Splitting them by value like this makes it
possible to direct those queries straight to the relevant data.

### Hash

Hash partitioning splits your data into partitions based on a hash of
the partitioning key. This type of partitioning is much rarer than the
others and is generally only used if there's no meaningful way to
partition by range or list. You create a hash partitioned table like
so:

```sql
CREATE TABLE invoice (
  uuid UUID PRIMARY KEY
) PARTITION BY hash (uuid);

CREATE TABLE invoice_0
  PARTITION OF invoice
  FOR VALUES WITH (MODULUS 2, REMAINDER 0);

CREATE TABLE invoice_1
  PARTITION OF invoice
  FOR VALUES WITH (MODULUS 2, REMAINDER 1);
```

You can use any combination of `MODULUS` and `REMAINDER`, as long as
your partitions don't overlap. What this partitioning type effectively
does is to evenly distribute rows among a number of partitions, which
can really help with insert performance since multiple backends are
able to write new rows simultaneously. Each partition can be placed
into a different tablespace backed by independent storage medium,
further improving IO performance.

There are some big drawbacks of hash partitioning however. They offer
no advantage for indexing since rows are spread into partitions
practically at random. This means that queries will need to scan all
partitions to find records unless a specific partition key value is
specified. I.e.

```sql
  SELECT * FROM invoice WHERE
    uuid='d9ecdfbd-528d-4b3c-88d4-b4a6cec28772';
```

This query can skip straight to the partition the row is in.

```sql
  SELECT * FROM invoice WHERE
    created_at >= NOW() - INTERVAL '1 DAY';
```

Whereas this query will need to search each partition for matching
rows.

They don't help with bulk operations as it's unlikely you'll ever want
to deleted all rows for which their partition key modulus _n_ = _x_.

The number of partitions is fixed, if you want to change it, you need
to manually move data around, which is possible, but there is no
built-in automation to help you.

### Combinations

You can also partition a partition for multi-level structures. For
example, here's an invoice partitioned table using both range and list
partitioning types.

```sql
CREATE TYPE invoice_status AS ENUM ('created', 'paid', 'cancelled');

CREATE TABLE invoice (
  uuid UUID DEFAULT gen_random_uuid(),
  status invoice_status NOT NULL,
  created_at TIMESTAMP DEFAULT now()
) PARTITION BY LIST (status);

CREATE TABLE invoice_created
  PARTITION OF invoice
  FOR VALUES IN ('created');

CREATE TABLE invoice_paid
  PARTITION OF invoice
  FOR VALUES IN ('paid')
  PARTITION BY RANGE (created_at);

CREATE TABLE invoice_paid_2025_05
  PARTITION OF invoice_paid
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE invoice_cancelled
  PARTITION OF invoice
  FOR VALUES IN ('cancelled')
  PARTITION BY RANGE (created_at);

CREATE TABLE invoice_cancelled_2025_05
  PARTITION OF invoice_cancelled
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
```

This way you have a partition for created invoices, and two sets of
partitions for paid and cancelled invoices organised by month.

## Querying Partitioned Tables

The main feature of partitioned tables is that they can be transparent
to applications. That is to say that they can simply query the parent
table (e.g. `invoice`) and everything will work just as expected if it
were one large table. In addition to that, each partition is also
queryable as they are just tables after all. This gives the advantage
of directly querying the relevant data without extraneous WHERE clauses
or index scanning (e.g. directly querying `invoice_cancelled` for
cancelled invoices).

Let's go a bit deeper and explore some key concepts and features.

### Partition Pruning

When you issue a query, PostgreSQL automatically skips partitions that
don't contain relevant rows based on the WHERE clause and the
partitioning key. It goes without saying, that the more of the data you
can prune up-front, the more performant the query will be.

### Partition Indexes

Indexes are **per-partition** rather than global, but this doesn't mean
that queries on the parent table can't make use of them. When
PostgreSQL is executing a query, it can still make effective use of the
per-partition indexes.

Indexes defined on the parent table will be inherited by it's
partitions, but note that adding or modifying indexes on the parent
table in this way cannot be done concurrently, and will hold a lock for
an extended time.

You are able to define different indexes on each partition to optimise
queries for the specific data contained within. This can be very useful
since each partition is queried separately in a query plan, it allows
you to define indexes appropriate for that chunk of data without
needlessly including all the rest.

### The Query Plan

You can use `EXPLAIN` or `EXPLAIN ANALYZE` to see details about how
partitions are handled for a given query. For example, with this set of
partitions:

```psql
postgres=# \d
                     List of relations
 Schema |        Name        |       Type        |  Owner
--------+--------------------+-------------------+----------
 public | invoice            | partitioned table | postgres
 public | invoice_2025_05_26 | table             | postgres
 public | invoice_2025_05_27 | table             | postgres
 public | invoice_2025_05_28 | table             | postgres
 public | invoice_2025_05_29 | table             | postgres
 public | invoice_2025_05_30 | table             | postgres
(6 rows)
```

You can see that a query plan to select rows where `created_at >
'2025-05-28 12:00:00+00'`, results in a query plan that ignores
partitions `invoice_2025_05_26` and `invoice_2025_05_27`, while
applying the filter to `invoice_2025_05_28` as well as
the remaining future partitions:

```sql
EXPLAIN SELECT COUNT(*) FROM invoice
  WHERE created_at > '2025-05-28 12:00:00+00';
                                QUERY PLAN
-------------------------------------------------------------------------
 Aggregate
   ->  Append
         ->  Seq Scan on invoice_2025_05_28 invoice_1
               Filter: (created_at > '2025-05-28 12:00:00+00'::timestamp)
         ->  Seq Scan on invoice_2025_05_29 invoice_2
               Filter: (created_at > '2025-05-28 12:00:00+00'::timestamp)
         ->  Seq Scan on invoice_2025_05_30 invoice_3
               Filter: (created_at > '2025-05-28 12:00:00+00'::timestamp)
(8 rows)
```

In this way, using the query plan is useful for troubleshooting
performance issues when querying partitioned tables.

## The Default Partition

Ok, so you have a partitioned table and a bunch of partitions for
various key values. Let's say your automation failed to create today's
partition for some reason. What happens when records are inserted?

```psql
postgres=# INSERT INTO invoice (created_at) values (now());
ERROR:  no partition of relation "invoice" found for row
DETAIL:  Partition key of the failing row contains (created_at) = (2025-05-26 18:11:24.381469).
```

This may well be a disaster and bring your application to a halt. As a
fallback or fail-safe measure, you can create what's called a 'default
partition', to which all rows that don't fit any other partition will
be inserted.

```sql
CREATE TABLE invoice_default
  PARTITION OF invoice DEFAULT;
```

Now, when we insert a row that doesn't fit any existing partition, it
will be inserted into this one, maintaining operational uptime for the
partitioned table.

While this is convenient, it's a double edged sword. Default partitions
can be quite difficult to manage in many cases. For example, each time
you add a new partition to a table, PostgreSQL needs to scan the
default partition to ensure it doesn't contain any rows that ought to
be in the new partition. A lock is held while performing this scan, so
the more rows in the default partition, the longer the whole
partitioned table is locked while scanning. This can cripple a database
if a significant number of records have made their way to the default
partition and for high traffic tables, this can occur much faster than
you might expect.

In fact, the most troublesome issues with partitioned tables are
complicated by default partitions. See the [When Things Go
Wrong](#when-things-go-wrong) section for examples.

## Maintenance and Management

One of the big advantages of partitioning is that you can manage large
chunks of data by manipulating the partitions, which is a lot easier
than physically moving rows.

### Deletion

You can, for example, delete potentially millions of rows by just
dropping a partition:

```sql
DROP TABLE orders_2025_05_26;
```

This is a lot faster than would otherwise be possible in a single table
because there's no need to find and drop tuples individually. It also
avoids the potential table bloat and the need to vacuum.

### Addition

You already know how to add partitions from earlier, i.e.:

```sql
CREATE TABLE invoice_2025_05_26
  PARTITION OF invoice
  FOR VALUES FROM ('2025-05-26') TO ('2025-05-27');
```

But sometimes it's desirable to create a table separately first, and
then attach it as a partition.

```sql
CREATE TABLE invoice_2025_05_26
LIKE invoice
  INCLUDING DEFAULTS
  INCLUDING CONSTRAINTS
  INCLUDING INDEXES;

ALTER TABLE invoice ATTACH PARTITION invoice_2025_05_26
  FOR VALUES FROM ('2025-05-26') TO ('2025-05-27');
```

### Automation

As you may have noticed, there's no built-in automation for creating or
removing partitions, especially important for time based range
partitions. What are you supposed to do? create every partition for the
foreseeable future up-front?

Well, the solution is to either code this yourself using tools like
`pg_cron` or to use an extension to do this for you. One such extension
is [pg_partman](https://github.com/pgpartman/pg_partman), which, as the
name suggests, is a partition manager. It has many helpful features:

- **Automatic creation of time range based partitions** - This is the
  main feature in my mind, `pg_partman` can run a maintenance task on a
  schedule to automatically create partitions up to a configurable time
  in the future.
- **Automatic retention** - As part of the same maintenance task, it
  can drop or detach partitions older than a configured retention time.
- **Partition templates** - These allow you to create a template for
  new partitions with settings that otherwise aren't possible with the
  standard `CREATE TABLE ... PARTITION OF ...` syntax.
- **Convenience functions and procedures** - Provides many useful tools
  to do things like migrate data into partitions, checking default
  partitions for rows, creating partitions in bulk and much more.

## When Things Go Wrong

### Common Errors

Here I'll simply list a handful of common errors, an explanation about
them and what to do about it.

> ERROR: updated partition constraint for default partition
> "invoice_default" would be violated by some row`

This happens when you try to attach a partition for a value range for
which the default partition currently holds a row. When you add a
partition, PostgreSQL needs to add a constraint to the default
partition that says it doesn't contain any rows that ought to be in the
new partition. To add that constraint, it needs to scan the default
partition to make sure it's true. During that scan, if it finds a
conflicting row, it will emit this error.

Often the root cause of this is due to a poor choice of partitioning
key, one that can be chosen to be in the future or for a value that may
not yet have a partition. For example, if you have a `calendar_event`
table, and your partitioning key is the `event_date` column, then it
would be perfectly natural for `event_date`s in the future to be
inserted. If the future date happens to be one for which you don't yet
have a partition for, then it will be inserted into the default
partition and eventually result in this error.

The immediate fix is to move the rows out from the default partition
first, then create the new partition and, optionally, put the removed
rows back into the new partition. Beyond this though, the reason why
rows ended up in the default partition should be investigated and
resolved as well. If it was due to a poor partitioning key, then you
can work on migrating to a different one or enforcing that future dates
or unaccounted for values can't be inserted.

> locking failure as the tuple was moved to another partition

This occurs for queries trying to lock a row in a partition that, in
another transaction, has been updated in such a way as to move it to a
different partition. This is usually down to a poor choice of
partitioning key, one that can be updated and cause the row to move
partitions. There's not a lot that can be done about this on the
database level.

Ideally the partitioned table should be recreated with a different
partitioning key to avoid this happening at all. Your application can
also implement retries or other error handling strategies to mitigate
the impact. Another option that may or may not be acceptable, is to use
`FOR UPDATE SKIP LOCKED` in a transaction to skip updating the rows
that have been moved.

```sql
# Set all created invoices to paid
BEGIN;

WITH invoices_to_update AS (
  SELECT uuid FROM invoice
  WHERE status = 'created'
  FOR UPDATE SKIP LOCKED
)
UPDATE invoice
SET status = 'paid'
FROM invoices_to_update
WHERE invoice.uuid = invoices_to_update.uuid;

COMMIT;
```

> ERROR: unique constraint on partitioned table must include all
> partitioning columns
>
> DETAIL: PRIMARY KEY constraint on table "invoice" lacks column
> "created_at" which is part of the partition key.

Partitions with primary or unique keys, require that the partition key
be part of it. This is because each partition is a separate table and
there's no way to enforce uniqueness across all tables. By requiring
that the partition key be part of the unique key, PostgreSQL is
ensuring that a violation of the unique constraint can never happen.

Where this will fail:

```sql
CREATE TABLE invoice (
  uuid UUID PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
) PARTITION BY RANGE (created_at);
```

This will succeed:

```sql
CREATE TABLE invoice (
  uuid UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (uuid, created_at)
) PARTITION BY RANGE (created_at);
```

> ERROR: no partition of relation "invoice" found for row
>
> DETAIL: Partition key of the failing row contains (created_at) =
> (2025-05-31 14:08:46.126612+00).

This is fairly straight forward, there's simply no partition for the
value range required by the new row. The solution is to create the
partition, or fix the tooling used to automatically create partitions,
whatever it is you use.

```sql
INSERT INTO invoice (created_at) VALUES (NOW());
ERROR:  no partition of relation "invoice" found for row
DETAIL:  Partition key of the failing row contains (created_at) = (2025-05-31 14:08:46.126612+00).

CREATE TABLE invoice_2025_05_31
  PARTITION OF invoice
  FOR VALUES FROM ('2025-05-31') TO ('2025-06-01');

INSERT INTO invoice (created_at) VALUES (NOW());
# Success
```

> ERROR: new row for relation "invoice_created" violates partition
> constraint
>
> DETAIL: Failing row contains (ed3709da-45fd-4f6a-af6c-050593929a9e,
> paid, 2025-05-26 20:24:22.407953).

This often occurs when an update to the partitioning key is attempted
against a partition directly. For example, if the `status` column is a
list type partitioning key:

```sql
UPDATE invoice_created SET status='paid' WHERE uuid='d9ecdfbd-528d-4b3c-88d4-b4a6cec28772';
```

You might expect this to move the row to the `invoice_paid` partition,
but actually it fails with the above error. This is because, PostgreSQL
expects that updates to a partitioning key will move it between _child_
partitions, not _siblings_. The solution is to perform the update on
the parent table:

```sql
UPDATE invoice SET status='paid' WHERE uuid='d9ecdfbd-528d-4b3c-88d4-b4a6cec28772';
```

This will successfully update the partitioning key and move the row to
the other partition.

### Code Brown

By far the most frustrating problem I see for partitioned tables, which
may only be because they get thrown over the fence to me, is when the
default partition has grown beyond what's easily manageable. So large
that it's become impossible to add new partitions without intolerable
customer impact due to the need to scan all rows to validate none exist
that should be in the new partition. The insidious thing about it is
that it isn't immediately obvious and only becomes clear when it gets
truly large. Your tooling (such as `pg_partman`) won't complain about
it because as far as it's aware everything is working, it successfully
creates new partitions as required, never-mind that the table is
completely locked for hours at a time.

Anyway, moving past my trauma, consider this situation. You have a
table range partitioned by time, it stopped getting new partitions
months ago and since then all new rows have been inserted into the
default partition, which is now 200GB in size. Attaching a new
partition is effectively impossible for the interruption it would case.
What do you do?

Without going into too much detail, there are ways to mitigate the
issue in the meantime while the data is moved. Namely, you can add a
partition without performing the scan on the default partition by using
check constraints. If you create a check constraint on the default
table that validates that there are no rows matching your intended new
partition, then PostgreSQL is smart enough to see that and know it
doesn't need to do a scan to check itself. The clincher is that you can
add that check constraint concurrently to avoid locking the table while
you do it.

```sql
# Adds a non-validated check constraint to the default partition
ALTER TABLE invoice_default
  ADD CONSTRAINT temp_check_constraint_partition_2025_06_26
    CHECK (
      created_at < '2025-05-26' OR
      created_at >= '2025-05-27'
    )
  NOT VALID;

# Performs a concurrent validation of the constraint
ALTER TABLE invoice_default
  VALIDATE CONSTRAINT temp_check_constraint_partition_2025_06_26;

# Now this should not require a long scan and complete more or less instantly
CREATE TABLE invoice_2025_05_26
  PARTITION OF invoice
  FOR VALUES FROM ('2025-05-26') TO ('2025-05-27');
```

Be very careful writing your check constraint as at this point the
default partition is the currently active target for inserts, you can
easily create a constraint that blocks new inserts by accident. You
should also be sure to either successfully create the new partition or
delete the check constraint so that when that time period comes, rows
still have somewhere to go.

Once you've bought yourself time with enough future partitions, you can
work on migrating data out of the default partition into appropriate
partitions of their own. You might do this by copying data into new
tables and adding them as partitions individually, or by waiting long
enough that you can safely and comfortably delete the data by
truncating the default partition.

I could go into a lot more detail, but this section is a bit long
winded already and I think I should move on, emotionally.

## Best Practices

### Choose the Right Partitioning Key

It's important to choose a partitioning key that is as immutable as
possible. A `created_at` column is a great choice. It's never changed,
so it won't cause the row to move to different partitions. And it's set
to "now", making it easier to write automation to ensure there's always
a valid partition.

For list based partitioning, it's often convenient to use a mutable key
(such as `invoice.status` used as an example in this article), and
that's a trade-off you'll need to be aware of and to accommodate for in
your application code. Still try to use an immutable column for list
type partitioning as well, if possible.

### Keep Partitions Small

The primary benefit of partitioning is that data is split into smaller
manageable tables. Managing a partitioned table where the partitions
are still big bloated monsters will add more complexity than it's
worth. So, consider daily or even hourly partitions instead of monthly,
for example.

### Be Pragmatic When Deciding if You Really Need Partitioning

Make sure there are clear benefits to partitioning a table, don't
partition things just because you read on some blog that it's good for
performance. If your data is suitably performant and there's no
foreseeable need for partitioning, then it's not necessary and will
only add more of a maintenance burden for you and your team.

### Automate Partition Management and Monitor it Effectively

For range based partitioning, it's crucial to ensure new partitions are
reliably added and old ones pruned to ensure partitioning continues to
operate and provide its benefits. If partitions stop being created,
then you're often left in a situation that's worse than not having
partitioning at all such as failing queries, degraded performance and
difficult migration tasks for data in default partitions.

So set up strong reliable automation and monitoring with alerts that
will be acted upon. I've found that clear documentation such as
runbooks help empower engineers to understand the issue and know what
to do on the spot.

## Monitoring and Observability

You won't be surprised that I recommend close monitoring of rows in
default partitions. Any insertion of rows to default partitions should
be handled as fast as possible to avoid it growing out of hand.

You'll also want to monitor successful executions of whatever you use
to automate creation of new partitions, if you need such a thing. You
can have enough future partitions made that if you catch an issue with
your automation early enough, you can avoid needing to handle any stray
rows making it to your default partitions.

Another good thing to keep under control is the actual number of
partitions. There's no limit as such, but if you have over 1000
partitions, then more than likely, something is wrong. If that's not
unexpected for your use case, it It may be more useful to measure the
rate of new partitions. This could catch issues with partition clean-up
processes or issues causing creation of new partitions to frequently.

## Afterword

Partitioning is a powerful tool for management of large tables, but as
with most things, it comes with a whole new world of things that can go
wrong. Things are becoming easier with each new release of PostgreSQL,
but as you've read in this blog, there are a lot of things you need to
be aware of to use them effectively and reliably.
