"""N-02-4 팀 개발용 AES·HMAC 키 한 쌍을 만들어 저장소 밖 env 파일로 저장한다. 키 값은 화면에 출력하지 않는다."""
import argparse
import base64
import os
from pathlib import Path
import secrets
import sys


def repo_root(start=None):
    """이 스크립트에서 위로 올라가며 .git이 있는 저장소 루트를 찾는다."""
    here = Path(start or __file__).resolve()
    for folder in [here, *here.parents]:
        if (folder/'.git').exists(): return folder
    raise ValueError('저장소 루트(.git)를 찾지 못했습니다')


def inside_repo(path, root=None):
    """경로가 저장소 루트 아래(루트 포함)인지 확인한다."""
    target = Path(path).resolve(); root = (root or repo_root()).resolve()
    return target == root or root in target.parents


def write_keys(path, root=None):
    """32바이트 AES 키와 32바이트 HMAC 키를 Base64로 저장한다. 저장소 안 경로·이미 있는 파일은 거부한다."""
    target = Path(path)
    if inside_repo(target, root): raise ValueError('키 파일은 저장소 밖에 저장해야 합니다')
    aes, mac = secrets.token_bytes(32), secrets.token_bytes(32)
    while mac == aes: mac = secrets.token_bytes(32)
    body = (f'AVENUE_DEV_AES_KEY={base64.b64encode(aes).decode()}\n'
            f'AVENUE_DEV_HMAC_KEY={base64.b64encode(mac).decode()}\n'
            'AVENUE_DEMO_PASSWORD=\n')
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        # 'x' 모드: 파일이 이미 있으면 덮어쓰지 않고 실패한다.
        with target.open('x', encoding='utf-8', newline='\n') as handle: handle.write(body)
    except FileExistsError:
        raise ValueError('이미 파일이 있습니다. 덮어쓰지 않습니다') from None
    try: os.chmod(target, 0o600)
    except OSError: pass
    return target.resolve()


def main():
    """CLI: 경로 하나만 받는다. 출력은 저장 경로와 다음 단계 안내뿐이다."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('path', help='저장소 밖 env 파일 경로')
    args = parser.parse_args()
    try: saved = write_keys(args.path)
    except (ValueError, OSError) as error:
        print('키 생성 중단: ' + str(error), file=sys.stderr); return 1
    print(f'저장함: {saved}')
    print('다음: 파일을 디스코드 비공개 채널로 공유하고, AVENUE_DEMO_PASSWORD 값을 채운 뒤 build_db_v02.py --env-file 로 시드를 만드세요.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
