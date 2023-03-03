import os
from sqlalchemy import (
    Column,
    Table,
    ForeignKey,
    Index,
    Integer,
    String,
    Date,
    DateTime,
    Text,
    create_engine,
    types,
    Float,
    inspect,
    MetaData,
)
from sqlalchemy.orm import declarative_base, sessionmaker

from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.sql.schema import UniqueConstraint
from sqlalchemy.orm import declarative_base

# Local application imports
# -------------------------
# This creates the base class we will use to create models

Base = declarative_base()

# authors will have a role defined for their user_id in auth_group and auth_membership
engine = create_engine(os.environ["DEV_DBURL"])
Session = sessionmaker(expire_on_commit=False)
engine.connect()
Session.configure(bind=engine)
meta = MetaData()

# Create table objects from database metadata that we do not control but want to use
# in this application.
auth_user = Table("auth_user", meta, autoload=True, autoload_with=engine)
courses = Table("courses", meta, autoload=True, autoload_with=engine)
library = Table("library", meta, autoload=True, autoload_with=engine)
course_instructor = Table(
    "course_instructor", meta, autoload=True, autoload_with=engine
)


class BookAuthor(Base):
    __tablename__ = "book_author"
    # See https://stackoverflow.com/questions/28047027/sqlalchemy-not-find-table-for-creating-foreign-key
    # for why we do not use a string to specify the foreign key for author
    author = Column(
        String(512), ForeignKey(auth_user.c.username), primary_key=True, nullable=False
    )
    book = Column(
        String(50), ForeignKey(library.c.basecourse), primary_key=True, nullable=False
    )


Base.metadata.create_all(bind=engine)
