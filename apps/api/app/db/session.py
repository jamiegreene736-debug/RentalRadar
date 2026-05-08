from __future__ import annotations

from collections.abc import Generator
from uuid import UUID

from sqlalchemy import select
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.db.models import AppUser, Base, Organization, OrganizationMember

settings = get_settings()
DEFAULT_ORGANIZATION_ID = UUID("00000000-0000-0000-0000-000000000001")
DEFAULT_USER_ID = UUID("00000000-0000-0000-0000-000000000002")

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


def initialize_database() -> None:
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        organization = db.get(Organization, DEFAULT_ORGANIZATION_ID)
        if organization is None:
            organization = Organization(
                id=DEFAULT_ORGANIZATION_ID,
                name="RentalRadar Demo Organization",
                slug="rentalradar-demo",
            )
            db.add(organization)

        user = db.get(AppUser, DEFAULT_USER_ID)
        if user is None:
            user = AppUser(
                id=DEFAULT_USER_ID,
                email="setup@rentalradar.ai",
                full_name="RentalRadar Setup",
                default_organization_id=DEFAULT_ORGANIZATION_ID,
            )
            db.add(user)

        membership = db.scalar(
            select(OrganizationMember)
            .where(OrganizationMember.organization_id == DEFAULT_ORGANIZATION_ID)
            .where(OrganizationMember.user_id == DEFAULT_USER_ID)
        )
        if membership is None:
            db.add(
                OrganizationMember(
                    organization_id=DEFAULT_ORGANIZATION_ID,
                    user_id=DEFAULT_USER_ID,
                    role="owner",
                )
            )

        db.commit()


if settings.environment == "production":
    initialize_database()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
