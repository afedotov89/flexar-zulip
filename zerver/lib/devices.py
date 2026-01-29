import base64

from typing_extensions import TypedDict

from zerver.lib.timestamp import datetime_to_timestamp
from zerver.models.devices import Device
from zerver.models.users import UserProfile


class DeviceInfoDict(TypedDict):
    push_key_id: int | None
    push_token_id: str | None
    pending_push_token_id: str | None
    push_token_last_updated_timestamp: int | None
    push_registration_error_code: str | None


def b64encode_token_id_int(token_id_int: int) -> str:
    token_id_bytes = token_id_int.to_bytes(8, byteorder="big", signed=True)
    return base64.b64encode(token_id_bytes).decode()


def get_devices(user_profile: UserProfile) -> dict[str, DeviceInfoDict]:
    devices = Device.objects.filter(user=user_profile)

    devices_dict: dict[str, DeviceInfoDict] = dict()
    for device in devices:
        push_token_id_base64 = None
        pending_push_token_id_base64 = None
        push_token_last_updated_timestamp = None

        if device.push_token_id is not None:
            push_token_id_base64 = b64encode_token_id_int(device.push_token_id)
        if device.pending_push_token_id is not None:
            pending_push_token_id_base64 = b64encode_token_id_int(device.pending_push_token_id)
        if device.push_token_last_updated_timestamp is not None:
            push_token_last_updated_timestamp = datetime_to_timestamp(
                device.push_token_last_updated_timestamp
            )

        devices_dict[str(device.id)] = DeviceInfoDict(
            push_key_id=device.push_key_id,
            push_token_id=push_token_id_base64,
            pending_push_token_id=pending_push_token_id_base64,
            push_token_last_updated_timestamp=push_token_last_updated_timestamp,
            push_registration_error_code=device.push_registration_error_code,
        )

    return devices_dict
