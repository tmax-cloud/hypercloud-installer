# v5.0.2 (2020.05.14)

### Features

-

### Fixes

- haproxy 설치 스크립트 수정 (IMS: 258401)

---

# v5.0.1 (2020.04.29)

### Features

-

### Fixes

- haproxy 설치 스크립트 추가 (IMS: 258401)
- hypercloud 삭제 시, user delete 로직 추가 (IMS: 245904)

---

# v5.0.0 (2020.04.22)

### Features

- 설치 로직을 스크립트 실행하는 형태로 모두 변경
- 각 모듈 5.0 가이드 적용

### Fixes

- 시간 동기화 패키지 변경 (NTP->Chrony) (IMS: 258684)
- 프로메테우스 설치 파라미터 변경 (IMS: 256961, 256907)
  - 그라파나 설치 포함 유지
  - 프로메테우스에서 사용할 PVC 용량만 입력 받는 것으로 변경
- Kubernetes 설치 시, Service network 입력 추가 (IMS: 255338)

---

# v4.1.13 (2020.04.14)

### Features

-

### Fixes

- Console version up (4.1.4.23 -> 4.1.4.25) (IMS: 257098)
  - @@HIDDEN@@ flag 'false' 로 설정
- Kubernetes 설치 시, POD network 힌트 메시지 수정 (IMS: 255339)

---

# v4.1.12 (2020.02.24)

### Features

- HyperAuth 버전 변경(1.0.14.41)
- Console 버전 변경(4.1.4.23)
- Console 설치 git project 분리 적용

### Fixes

-

---

# v4.1.11 (2020.02.18)

### Features

- Grafana 설치 git project 분리

### Fixes

- kubeadm join 후 kubernetes config 파일 생성되도록 수정 (IMS: 253893)
- hypercloud-operator 설치 시, 6.default-auth-object-init.yaml에 sed하는 문자열 변경 (IMS: 253682)
  - admin-tmax.co.kr -> hc-admin@tmax.co.kr
- rook-ceph 제거 시, 모든 노드에서 /var/lib/rook 폴더 제거 (IMS: 253344)
- hypercloud-webhook 버전 변경 (IMS: 253058)
- kubeconfig.yaml파일의 advertiseAddress 부분에 MainMaster IP들어가도록 수정

---

# v4.1.10 (2020.02.04)

### Features

- 각 모듈 설치 github repo 분리 (console 제외)

### Fixes

- 분리된 repo에 맞게 각 모듈 version up (IMS: 253058, 247118)
- rook ceph 설치 시, mon 값 수정 (IMS: 252725)
- 기존 cluster에, 마스터 추가 시, taint 제거 로직 추가 (IMS: 249186)
- k8s설치 전, lvm2 패키지 설치 (IMS: 248685)

---

# v4.1.9 (2020.01.07)

### Features

- 환경 수정 시, 마스터 노드 추가, 삭제 기능 추가 (IMS: 249186)
- 환경 추가 시, VIP 설정 기획 적용 (IMS: 243541)

### Fixes

- NTP 패키지 설치 순서 변경 (IMS: 248685)

---

# v4.1.8 (2020.12.10)

### Features

- 설치 프로그래스 바 갱신 주기 변경
  - 기존 일정 시간마다 1% 씩 자동으로 채워지던 기능 제거
- Script 실행 timeout 시간 변경
  - 기존 5분에서 10분으로 변경
- 각 제품 설치 단계에서 부가적인 설명 추가

### Fixes

- HyperCloud-Operator 버전 변경 (4.1.1.0 -> 4.1.4.7) (IMS: 247118)
- Rook-Ceph 버전 표기 변경 (ceph버전 -> rook버전) (IMS: 247118)

---

# v4.1.7 (2020.12.03)

### Features

- 제품 설치 중일 때, LNB에 Loader 표시 추가
- 각 제품 설치 완료 페이지에 Detail 정보 추가
  - Kubernetes: POD subnet 정보
  - MetalLB: IP range 정보
  - Rook Ceph: Disk 이름, 용량 정보
  - Prometheus: PVC 사용여부, Service type/port 정보
  - HyperCloud: Admin User 정보
- HyperCloud 로고 변경

### Fixes

- Rook Ceph 설치 시, cluster.yaml의 spec.mon.count를 권장값 3으로 설정 (IMS: 242409)
- Rook Ceph 설치 시, 설정한 spec이 culster.yam에 적용되도록 수정 (IMS: 242409)
- 제품 삭제 시, 로딩이 무한으로 되는 현상 수정

---

# v4.1.6 (2020.11.26)

### Features

- No changes

### Fixes

- hypercloud 재설치 경우, admin user 로그인 안되는 현상 수정 (IMS: 245904)
- rook-ceph 설치 화면에서, cpu,memory 설정 시, 선택한 disk 초기화 되는 현상 수정
- Tekton CI/CI Template version 수정 (4.1.4.6 -> 1.1.5)

---

# v4.1.5 (2020.11.19)

### Features

- Install Page 검색 기능 추가
- LNB상에 현재 진입한 설치 모듈 표시

### Fixes

- 설치한 제품 삭제시 초기화 요청 (IMS: 245163)
- rook-ceph 삭제 안되는 현상 (IMS: 245131)

---

# v4.1.4 (2020.11.12)

### Features

- Rook Ceph 설치 시, 입력 값 추가
  - OSD, MON, MGR, MDS의 CPU, Memory 입력
  - OSD 설치 할 Disk 입력 (IMS: 242409)
- Prometheus 설치 시, 입력 값 추가
  - PVC 사용 여부 선택
  - Service type, port 입력
- HyperCloud 설치 시, 입력 값 추가
  - Ingress Controller 설치 옵션 선택
  - admin계정 ID/PW 입력 (IMS: 243092)

### Fixes

- No changes

---

# v4.1.3 (2020.11.05)

### Features

- Node 추가 시, HostName 미입력 시 자동 생성 기능 추가 (IMS: 242540)

### Fixes

- Master 다중화 설치 시, Master Join 후, Kube config 적용되도록 수정 (IMS: 242766)
- HyperAuth 설치 시, kube-apiserver.yaml에 oidc 연동 IP 들어가지 않던 문제 해결

---

# v4.1.2 (2020.10.26)

### Features

- Node 추가 시, HostName, User 입력 받는 기능 추가 (IMS:242540)
- 설치화면에서 권장 설치 순서 보여주는 LNB Stepper로 변경 (IMS:242540)
- HyperCloud 설치 완료 화면에서, console로 이동하기 버튼 추가 (IMS:242540)
- Kubernetes 설치 시, Pod network 대역 입력 받는 기능 추가

### Fixes

- Master 다중화에서 keepalive 설치 시, network interface 가져오는 스크립트 수정 (IMS: 242561)
- Master 다중화 설치 시, 각 노드 설정 누락되는 현상 수정 (IMS:242766)
- Nginx 설치 가이드 변경에 따른, 설치 스크립트 수정

---

# v4.1.1 (2020.10.15)

### Features

- 지원 OS 추가
  - Prolinux 지원
- Tekton 설치, 삭제 기능 추가
- Catalog Controller 설치, 삭제 기능 추가
- HyperCloud install 기능 수정
  - Template Service Broker 설치 단계 추가

### Fixes

- kube-apiserver.yaml 수정 시, api server 정상동작 까지 시간 걸리는 이슈
  - polling으로 api server 정상동작 확인 후, 다음단계 진행하도록 수정
- IMS:241611
- IMS:241609

---

# v4.1.0 (2020.10.07)

### Features

- 환경 추가, 삭제 기능
  - OS: CentOS7만 지원
  - Network: 외부망(인터넷 접속 가능)만 지원
  - SSH 정보 입력
- 환경 수정 기능
  - 이름 변경
  - worker 노드 추가
- Kubernetes 설치, 삭제 기능
  - Image Registry : public Docker hub만 지원
- CNI 설치, 삭제 기능
- MetalLB 설치, 삭제 기능
- Rook Ceph 설치, 삭제 기능
  - OSD설치 가능한 디스크가 존재해야 설치 가능 (최소 1개 이상)
- Prometheus 설치, 삭제 기능
- HyperAuth 설치, 삭제 기능
- HyperCloud 설치, 삭제 기능

### Fixes

- No changes

---
