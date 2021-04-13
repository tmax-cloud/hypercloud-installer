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
    jq -V;

    # yq
    wget https://github.com/mikefarah/yq/releases/download/v4.6.3/yq_linux_amd64 -O /usr/bin/yq &&\\
    chmod +x /usr/bin/yq

    # sshpass
    sudo yum install -y http://mirror.centos.org/centos/7/extras/x86_64/Packages/sshpass-1.06-2.el7.x86_64.rpm;

    # hyperauth 인증 키 생성 관련
    yum install -y openssl
    yum install -y java-1.8.0-openjdk-devel.x86_64
    #apt install -y openssl
    #apt install -y oracle-java8-installer


    # epel pacakge repo 설치
    # crio에서 fuse-overlayfs 패키지가 필요한대, epel에 있음
    yum install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm;
    `;
  }

  installLvm2(): string {
    return `
    yum install -y lvm2;
    `;
  }

  installNtp(): string {
    return `
    yum install -y ntp;
    `;
  }

  installOpenSSL(): string {
    return `
    yum install -y openssl;
    yum install -y java-1.8.0-openjdk-devel.x86_64;
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
    priority: number,
    vip: string
  ): string {
    let state = '';
    if (node.role === ROLE.MAIN_MASTER) {
      state = 'MASTER';
    } else if (node.role === ROLE.MASTER) {
      state = 'BACKUP';
    }
    return `
    sudo yum install -y keepalived;
    interfaceName=\`ip -o -4 route show to default | awk '{print $5}'\`;
    echo "vrrp_instance VI_1 {
    state ${state}
    interface \${interfaceName}
    virtual_router_id 50
    priority ${priority}
    advert_int 1
    nopreempt
    authentication {
      auth_type PASS
      auth_pass 1234
      }
    virtual_ipaddress {
      ${vip}
      }
    }" > /etc/keepalived/keepalived.conf
    sudo systemctl restart keepalived;
    sudo systemctl enable keepalived;
    sudo systemctl status keepalived;
    `;
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
      rm -rf /etc/keepalived/;
      ${this.deleteDockerScript()}
      rm -rf ~/${Env.INSTALL_ROOT}/hypercloud-install-guide/;
      yum install -y ipvsadm;
      ipvsadm --clear;
      rm -rf /var/lib/etcd/;
      rm -rf /etc/kubernetes/;
      ${CniInstaller.deleteCniConfigScript()}
      ${deleteHostName}
      rm -rf ~/${KubernetesInstaller.INSTALL_HOME};
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
