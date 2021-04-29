/* eslint-disable no-underscore-dangle */
/* eslint-disable class-methods-use-this */
import Env, { NETWORK_TYPE } from '../Env';
import AbstractScript from './AbstractScript';
import KubernetesInstaller from '../installer/KubernetesInstaller';
import Node, { ROLE } from '../Node';
import CniInstaller from '../installer/CniInstaller';

/**
 * centos 스크립트 구현
 */
export default class CentosScript extends AbstractScript {
  startInstallKubernetes(): string {
    return `
    #install kubernetes
    if [[ -z \${k8sVersion} ]]; then
        k8sVersion=1.17.6
    else
        k8sVersion=\${k8sVersion}
    fi

    if [[ -z \${apiServer} ]]; then
        apiServer=127.0.0.1
    else
        apiServer=\${apiServer}
    fi

    if [[ -z \${podSubnet} ]]; then
        podSubnet=10.244.0.0/16
    else
        podSubnet=\${podSubnet}
    fi

    if [[ -z \${serviceSubnet} ]]; then
    serviceSubnet=10.96.0.0/16
    else
        serviceSubnet=\${serviceSubnet}
    fi

    #install kubernetes components
    sudo yum install -y kubeadm-\${k8sVersion}-0 kubelet-\${k8sVersion}-0 kubectl-\${k8sVersion}-0
    sudo systemctl enable --now kubelet

    sudo echo '1' > /proc/sys/net/ipv4/ip_forward
    sudo echo '1' > /proc/sys/net/bridge/bridge-nf-call-iptables

    #change kubeadm yaml
    sudo sed -i "s|{k8sVersion}|v\${k8sVersion}|g" \${yaml_dir}/kubeadm-config.yaml
    #sudo sed -i "s|advertiseAddress: {apiServer}|advertiseAddress: \${apiServer}|g" \${yaml_dir}/kubeadm-config.yaml
    sudo sed -i "s|advertiseAddress: {apiServer}|advertiseAddress: \${mainMasterIp}|g" \${yaml_dir}/kubeadm-config.yaml
    sudo sed -i "s|controlPlaneEndpoint: {apiServer}|controlPlaneEndpoint: \${apiServer}|g" \${yaml_dir}/kubeadm-config.yaml
    sudo sed -i "s|{podSubnet}|\${podSubnet}|g" \${yaml_dir}/kubeadm-config.yaml
    sudo sed -i "s|{serviceSubnet}|\${serviceSubnet}|g" \${yaml_dir}/kubeadm-config.yaml
    if [[ "\${imageRegistry}" == "" ]]; then
    sudo sed -i "s|{imageRegistry}/|\${imageRegistry}|g" \${yaml_dir}/kubeadm-config.yaml
    else
    sudo sed -i "s|{imageRegistry}|\${imageRegistry}|g" \${yaml_dir}/kubeadm-config.yaml
    fi
    `;
  }

  setEnvForKubernetes(hostName: string): string {
    return `
    ${AbstractScript.setHostName(hostName)}
    ${AbstractScript.registHostName()}
    ${AbstractScript.setInstallDir()}

    # disable firewall
    sudo systemctl disable firewalld
    sudo systemctl stop firewalld

    #swapoff
    sudo swapoff -a
    ## git에서 제공하는 스크립트와 다른 부분 /etc/fstab에서 swap들어간 줄 주석처리 ##
    sed -e '/swap/ s/^#*/#/' -i /etc/fstab

    #selinux mode
    sudo setenforce 0
    sudo sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config

    #crio-kube set
    sudo modprobe overlay
    sudo modprobe br_netfilter

    sudo cat << "EOF" | sudo tee -a /etc/sysctl.d/99-kubernetes-cri.conf
    net.bridge.bridge-nf-call-iptables  = 1
    net.ipv4.ip_forward                 = 1
    net.bridge.bridge-nf-call-ip6tables = 1
EOF
    sudo sysctl --system;
    `;
  }

  startInstallCrio(): string {
    return `
    # install crio
    sudo yum install -y cri-o
    sudo systemctl enable crio
    sudo systemctl start crio

    # check crio
    sudo systemctl status crio
    rpm -qi cri-o

    # remove cni0
    sudo rm -rf  /etc/cni/net.d/100-crio-bridge.conf
    sudo rm -rf  /etc/cni/net.d/200-loopback.conf
    sudo rm -rf /etc/cni/net.d/87-podman-bridge.conflist

    # edit crio config
    sudo sed -i 's/\\"\\/usr\\/libexec\\/cni\\"/\\"\\/usr\\/libexec\\/cni\\"\\,\\"\\/opt\\/cni\\/bin\\"/g' /etc/crio/crio.conf

    if [[ -z \${imageRegistry} ]]; then
      echo "image registry is not set"
    else
      # set crio registry config
      sudo sed -i 's/\\#insecure\\_registries = \\"\\[\\]\\"/\\insecure\\_registries = \\[\\"{imageRegistry}\\"\\]/g' /etc/crio/crio.conf
      sudo sed -i 's/\\#registries = \\[/registries = \\[\\"{imageRegistry}\\"\\]/g' /etc/crio/crio.conf
      sed -i 's/k8s.gcr.io/{imageRegistry}\\/k8s.gcr.io/g' /etc/crio/crio.conf
      sed -i 's/registry.fedoraproject.org/{imageRegistry}/g' /etc/containers/registries.conf
      sudo sed -i "s|{imageRegistry}|\${imageRegistry}|g" /etc/crio/crio.conf
      sudo sed -i "s|{imageRegistry}|\${imageRegistry}|g" /etc/containers/registries.conf
    fi
      sudo systemctl restart crio;
    `;
  }

  cloneGitFile(repoPath: string, repoBranch = 'master') {
    return `
    yum install -y git;
    mkdir -p ~/${Env.INSTALL_ROOT};
    cd ~/${Env.INSTALL_ROOT};
    git clone -b ${repoBranch} ${repoPath};
    `;
  }

  installPackage(): string {
    return `
    # wget
    sudo yum install -y wget;

    # jq
    sudo curl -L https://github.com/stedolan/jq/releases/download/jq-1.6/jq-linux64 -o /usr/local/bin/jq;
    sudo chmod a+x /usr/local/bin/jq;
    sudo jq -V;

    # yq
    wget https://github.com/mikefarah/yq/releases/download/v4.6.3/yq_linux_amd64 -O /usr/bin/yq &&\\
    sudo chmod +x /usr/bin/yq

    # sshpass
    sudo yum install -y http://mirror.centos.org/centos/7/extras/x86_64/Packages/sshpass-1.06-2.el7.x86_64.rpm;

    # hyperauth 인증 키 생성 관련
    sudo yum install -y openssl
    sudo yum install -y java-1.8.0-openjdk-devel.x86_64
    #apt install -y openssl
    #apt install -y oracle-java8-installer


    # epel pacakge repo 설치
    # crio에서 fuse-overlayfs 패키지가 필요한대, epel에 있음
    sudo yum install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm;
    `;
  }

  installLvm2(): string {
    return `
    sudo yum install -y lvm2;
    `;
  }

  installNtp(): string {
    return `
    sudo yum install -y ntp;
    `;
  }

  installChrony(): string {
    return `
    sudo yum install -y chrony;
    `;
  }

  installOpenSSL(): string {
    return `
    sudo yum install -y openssl;
    sudo yum install -y java-1.8.0-openjdk-devel.x86_64;
    `;
  }

  setKubernetesRepo(): string {
    // FIXME: 가이드 상에는 repo_gpgcheck=1 이지만, 설치 과정 에러가 가끔 발생하여 repo_gpgcheck=0으로 설정
    return `
    cat <<EOF | sudo tee /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://packages.cloud.google.com/yum/repos/kubernetes-el7-\\$basearch
enabled=1
gpgcheck=1
repo_gpgcheck=0
gpgkey=https://packages.cloud.google.com/yum/doc/yum-key.gpg https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
EOF`;
  }

  // FIXME: CentOS부분 prolinux에서 문제 생길 여지 있음
  setCrioRepo(crioVersion: string): string {
    return `
    sudo yum install -y yum-utils;
    yum-config-manager --enable 'CentOS-7 - Base';
    yum-config-manager --enable 'CentOS-7 - Extras';
    yum-config-manager --enable 'CentOS-7 - Updates';
    sudo yum clean all;

    # prolinux에서 container selinux 설치 해야 함
    sudo yum install -y http://mirror.centos.org/centos/7/extras/x86_64/Packages/container-selinux-2.107-3.el7.noarch.rpm;

    curl -L -o /etc/yum.repos.d/devel:kubic:libcontainers:stable.repo https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable/CentOS_7/devel:kubic:libcontainers:stable.repo;
    curl -L -o /etc/yum.repos.d/devel:kubic:libcontainers:stable:cri-o:${crioVersion}.repo https://download.opensuse.org/repositories/devel:kubic:libcontainers:stable:cri-o:${crioVersion}/CentOS_7/devel:kubic:libcontainers:stable:cri-o:${crioVersion}.repo;
    `;
  }

  getMasterMultiplexingScript(
    node: Node,
    masterList: Node[],
    priority: number,
    vip: string
  ): string {
    // https://github.com/tmax-cloud/hypercloud-install-guide/tree/old/K8S_Master_LBNode
    // 별도의 LBNode를 갖지 않고, 클러스터 내에서 HAProxy를 동작시킬 경우
    // 참고
    let state = '';
    if (node.role === ROLE.MAIN_MASTER) {
      state = 'MASTER';
    } else if (node.role === ROLE.MASTER) {
      state = 'BACKUP';
    }
    let script = `
      interfaceName=\`ip -o -4 route show to default | awk '{print $5}'\`;

      ${masterList
        .map((master, index) => {
          return `
          export MASTER${index}NAME=${master.hostName};
          export MASTER${index}IP=${master.ip};
          `;
        })
        .join('')}
      export MASTERPORT=6443;
      export HAPROXYLBPORT=16443;
      export VIP=${vip}


      # 파일 다운 받는 부분 install-k8s 5.0 브랜치로 이동 요청 해야
      wget https://raw.githubusercontent.com/tmax-cloud/hypercloud-install-guide/4.1/K8S_Master_LBNode/haproxy_nolb.cfg;
      wget https://raw.githubusercontent.com/tmax-cloud/hypercloud-install-guide/4.1/K8S_Master_LBNode/keepalived_nolb.conf;
      wget https://raw.githubusercontent.com/tmax-cloud/hypercloud-install-guide/4.1/K8S_Master_LBNode/lb_set_script_nolb.sh;
      wget https://raw.githubusercontent.com/tmax-cloud/hypercloud-install-guide/4.1/K8S_Master_LBNode/notify_action.sh;

      sudo setsebool -P haproxy_connect_any=1;
      sudo systemctl stop firewalld && sudo systemctl disable firewalld;

      sudo chmod +x lb_set_script_nolb.sh;
      sudo ./lb_set_script_nolb.sh;

      echo -e "global_defs {
        script_user root root
        enable_script_security off
      }

      vrrp_script chk_haproxy {
          script "/usr/sbin/pidof haproxy"
          interval 2
          weight 2
      }

      vrrp_instance VI_1 {
        state ${state}        # MASTER는 메인 Node, 백업 Node는  BACKUP 으로 설정
        interface \${interfaceName}    # 사용할 interface
        virtual_router_id 51
        priority ${priority}        # MASTER의 우선순위를 가장 높게(ex. 100), BACKUP의 경우 그보다 낮게(ex. 99, 98) 설정.
        advert_int 1
        authentication {    # 인증에 사용될 password(동일하게 맞춰주기만 하면 됨)
            auth_type PASS
            auth_pass 1111
        }

        unicast_src_ip ${node.ip}  # 현재 설치 중인 Node의 local ip

        unicast_peer {
            ${masterList
              .map(master => {
                if (master.ip === node.ip) {
                  return '';
                }
                return master.ip;
              })
              .join('\n')}             # 다른 Node의 local ip
        }

        virtual_ipaddress {
            ${vip}             # 클러스터 구성에 사용될 VIP!
        }

        notify_master "/bin/sh /etc/keepalived/notify_action.sh MASTER"
        notify_backup "/bin/sh /etc/keepalived/notify_action.sh BACKUP"
        notify_fault "/bin/sh /etc/keepalived/notify_action.sh FAULT"
        notify_stop "/bin/sh /etc/keepalived/notify_action.sh STOP"

        track_script {
            chk_haproxy
        }

        track_interface {
          \${interfaceName}          # 사용할 interface
        }
    }" > /etc/keepalived/keepalived.conf;
    `;

    script += `echo -e "
    global
    log 127.0.0.1 local2
    maxconn 2000
    uid 0
    gid 0
    daemon                # background process

    defaults
      log global            # global 설정 사용
      mode tcp              # SSL 통신을 위해서는 TCP모드로 (http모드는 SSL 안됨)
      option tcplog
      option dontlognull    # 데이터가 전송되지 않은 연결 로깅 제외
      retries 3             # 연결요청 재시도 횟수
      maxconn 2000          #option redispatch
      timeout connect 10s
      timeout client 1m
      timeout server 1m

    frontend k8s-api
      bind 0.0.0.0:$HAPROXYLBPORT	# Master Node와 동일 Node에 설치시, Master Join을 해당 port로 해야함.
      default_backend k8s-api

    backend k8s-api
      option tcp-check
      balance roundrobin
      ${masterList
        .map(master => {
          return `server ${master.hostName} ${master.ip}:$MASTERPORT check;`;
        })
        .join('\n')}
    " > /etc/haproxy/haproxy.cfg;
    `;

    return `
    ${script}
    sudo systemctl enable keepalived;
    sudo systemctl enable haproxy;

    sudo systemctl daemon-reload;

    sudo systemctl start keepalived;
    sudo systemctl start haproxy;

    sudo systemctl status keepalived;
    sudo systemctl status haproxy;
    `;
    // return `
    // sudo yum install -y keepalived;
    // interfaceName=\`ip -o -4 route show to default | awk '{print $5}'\`;
    // echo "vrrp_instance VI_1 {
    // state ${state}
    // interface \${interfaceName}
    // virtual_router_id 50
    // priority ${priority}
    // advert_int 1
    // nopreempt
    // authentication {
    //   auth_type PASS
    //   auth_pass 1234
    //   }
    // virtual_ipaddress {
    //   ${vip}
    //   }
    // }" > /etc/keepalived/keepalived.conf
    // sudo systemctl restart keepalived;
    // sudo systemctl enable keepalived;
    // sudo systemctl status keepalived;
    // `;
  }

  getK8sMasterRemoveScript(): string {
    const deleteHostName = `sudo sed -i /\`hostname\`/d /etc/hosts`;
    return `
      cd ~/${KubernetesInstaller.INSTALL_HOME}/manifest;
      sed -i 's|\\r$||g' k8s.config;
      ${AbstractScript.removeKubernetes()}
      yum remove -y kubeadm;
      yum remove -y kubelet;
      yum remove -y kubectl;
      yum remove -y cri-o;
      sudo yum remove -y keepalived;
      sudo yum remove -y haproxy;
      rm -rf /etc/keepalived/;
      rm -rf /etc/haproxy/;
      ${this.deleteDockerScript()}
      rm -rf ~/${Env.INSTALL_ROOT}/hypercloud-install-guide/;
      yum install -y ipvsadm;
      ipvsadm --clear;
      rm -rf /var/lib/etcd/;
      rm -rf /etc/kubernetes/;
      ${CniInstaller.deleteCniConfigScript()}
      ${deleteHostName}
      rm -rf ~/${KubernetesInstaller.INSTALL_HOME};
      rm -rf ~/${Env.INSTALL_ROOT}/multiplexing;
      `;
  }

  deleteDockerScript(): string {
    return `
    sudo yum remove -y docker \
    docker-client \
    docker-client-latest \
    docker-common \
    docker-latest \
    docker-latest-logrotate \
    docker-logrotate \
    docker-engine; \

    sudo yum remove -y docker-ce docker-ce-cli containerd.io;
    sudo rm -rf /var/lib/docker;

    rm -rf /etc/docker/daemon.json;
    `;
  }

  setDockerRepo(): string {
    return `
    sudo yum install -y yum-utils;
    sudo yum-config-manager \
    --add-repo \
    https://download.docker.com/linux/centos/docker-ce.repo;
    `;
  }

  getImageRegistrySettingScript(registry: string, type: string): string {
    return `
    ${this.deleteDockerScript()}
    cd ~/${KubernetesInstaller.IMAGE_REGISTRY_INSTALL_HOME};
    ${type === NETWORK_TYPE.EXTERNAL ? this.setDockerRepo() : ''}
    sudo yum install -y docker-ce docker-ce-cli containerd.io;
    sudo systemctl start docker;
    sudo systemctl enable docker
    sudo touch /etc/docker/daemon.json;
    echo "{ \\"insecure-registries\\": [\\"${registry}\\"] }" > /etc/docker/daemon.json;
    sudo systemctl restart docker;
    sudo systemctl status docker;
    chmod 755 run-registry.sh;
    sed -i 's|\\r$||g' run-registry.sh;
    sudo ./run-registry.sh ~/${
      KubernetesInstaller.IMAGE_REGISTRY_INSTALL_HOME
    } ${registry};
    `;
  }

  // FIXME: CentOS부분 prolinux에서 문제 생길 여지 있음
  setPackageRepository(destPath: string): string {
    return `
    cp -rT ${destPath} /tmp/localrepo;
    sudo yum install -y /tmp/localrepo/createrepo/*.rpm;
    sudo createrepo /tmp/localrepo;
    sudo cat <<EOF | sudo tee /etc/yum.repos.d/localrepo.repo
[localrepo]
name=localrepo
baseurl=file:///tmp/localrepo/
enabled=1
gpgcheck=0
EOF
    sudo yum --disablerepo=* --enablerepo=localrepo install -y yum-utils;
    yum-config-manager --disable 'CentOS-7 - Base';
    yum-config-manager --disable 'CentOS-7 - Extras';
    yum-config-manager --disable 'CentOS-7 - Updates';
    sudo yum clean all;
    #rm -rf ${destPath};
    `;
  }

  installGdisk(): string {
    return `
    yum install -y gdisk;
    `;
  }
}
