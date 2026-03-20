"""Shared DB connection pool for all MoneyTech crawlers.

Uses psycopg2's ThreadedConnectionPool so multiple crawlers
can share connections safely without creating new ones each time.
"""
from __future__ import annotations

import os
from contextlib import contextmanager

from psycopg2.pool import ThreadedConnectionPool

DATABASE_URL = os.environ.get("DATABASE_URL", "")

_pool: ThreadedConnectionPool | None = None


def get_pool() -> ThreadedConnectionPool:
    """Lazily initialise and return the global connection pool."""
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise RuntimeError(
                "DATABASE_URL is not set. "
                "Export it or add it to a .env file before running any crawler."
            )
        _pool = ThreadedConnectionPool(minconn=2, maxconn=10, dsn=DATABASE_URL)
    return _pool


@contextmanager
def get_conn():
    """Get a connection from the pool. Auto-returns on exit."""
    pool = get_pool()
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)


def close_pool() -> None:
    """Close every connection in the pool and reset the singleton."""
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None
