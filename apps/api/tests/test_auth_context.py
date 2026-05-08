from __future__ import annotations

from unittest.mock import Mock
from uuid import uuid4

from app.db.models import AppUser, Organization, OrganizationMember
from app.deps import ensure_auth_records


def test_ensure_auth_records_creates_workspace_user_and_membership() -> None:
    organization_id = uuid4()
    user_id = uuid4()
    db = Mock()
    db.get.return_value = None
    db.scalar.return_value = None

    ensure_auth_records(db, organization_id, user_id)

    added = [call.args[0] for call in db.add.call_args_list]
    assert any(isinstance(item, Organization) and item.id == organization_id for item in added)
    assert any(isinstance(item, AppUser) and item.id == user_id for item in added)
    assert any(
        isinstance(item, OrganizationMember)
        and item.organization_id == organization_id
        and item.user_id == user_id
        for item in added
    )
    db.commit.assert_called_once()
