import KubernetesInstaller from '../installer/KubernetesInstaller';
import Node from '../Node';

/* eslint-disable class-methods-use-this */
export default abstract class AbstractScript {
  /**
   * OS 디펜던시가 없는 스크립트들은 이곳에 만든다.
   */
  static setHostName(hostName: string): string {
    return `sudo hostnamectl set-hostname ${hostName};`;
  }

  static registHostName(): string {
    return `echo \`hostname -I\` \`hostname\` >> /etc/hosts;`;
  }

  static createSslCert() {
    const openSslCnfPath = '/etc/pki/tls/openssl.cnf';
    return `
    openssl req -newkey rsa:4096 -nodes -sha256 -keyout hyperauth.key -x509 -subj "/C=KR/ST=Seoul/O=tmax/CN=$(kubectl describe service hyperauth -n hyperauth | grep 'LoadBalancer Ingress' | cut -d ' ' -f7)" -days 365 -config <(cat ${openSslCnfPath} <(printf "[v3_ca]\nsubjectAltName=IP:$(kubectl describe service hyperauth -n hyperauth | grep 'LoadBalancer Ingress' | cut -d ' ' -f7)")) -out hyperauth.crt;
    kubectl create secret tls hyperauth-https-secret --cert=./hyperauth.crt --key=./hyperauth.key -n hyperauth;
    cp hyperauth.crt /etc/kubernetes/pki/hyperauth.crt;
    `;
  }

  static getK8sClusterMasterJoinScript(): string {
    return `
    cd ~/${KubernetesInstaller.INSTALL_HOME}/yaml;
    result=\`kubeadm init phase upload-certs --upload-certs --config=./kubeadm-config.yaml\`;
    certkey=\${result#*key:};
    echo "%%%\`kubeadm token create --print-join-command --certificate-key \${certkey}\`%%%"
    `;
  }

  static getK8sClusterWorkerJoinScript(): string {
    return `echo "@@@\`kubeadm token create --print-join-command\`@@@"`;
  }

  static getDeleteWorkerNodeScript(worker: Node): string {
    return `
  kubectl drain ${worker.hostName};
  kubectl delete node ${worker.hostName};
  `;
  }

  static startNtp(): string {
    return `
    systemctl start ntpd;
    systemctl enable ntpd;
    ntpq -p;
    `;
  }

  static setNtpClient(mainMasterIp: string): string {
    return `
    echo -e "server ${mainMasterIp}" > /etc/ntp.conf;
    ${this.startNtp()}
    `;
  }

  static setNtpServer(): string {
    return `
    interfaceName=\`ip -o -4 route show to default | awk '{print $5}'\`;
    inet=\`ip -f inet addr show \${interfaceName} | awk '/inet /{ print $2}'\`;
    network=\`ipcalc -n \${inet} | cut -d"=" -f2\`;
    netmask=\`ipcalc -m \${inet} | cut -d"=" -f2\`;
    echo -e "restrict \${network} mask \${netmask} nomodify notrap\nserver 127.127.1.0 # local clock" > /etc/ntp.conf;
    ${this.startNtp()}
    `;
  }

  static setPublicNtp(): string {
    return `
    echo -e "server 1.kr.pool.ntp.org\nserver 0.asia.pool.ntp.org\nserver 2.asia.pool.ntp.org" > /etc/ntp.conf;
    ${this.startNtp()}
    `;
  }

  /**
   * OS 디펜던시가 있는 스크립트들은
   * 각 OS abstract 클래스에서 구현
   */
  abstract cloneGitFile(repoPath: string, repoBranch: string): string;

  abstract installPackage(): string;

  abstract installNtp(): string;

  abstract setKubernetesRepo(): string;

  abstract setCrioRepo(crioVersion: string): string;

  abstract getMasterMultiplexingScript(
    node: Node,
    priority: number,
    vip: string
  ): string;

  abstract getK8sMasterRemoveScript(): string;

  abstract deleteDockerScript(): string;

  abstract setDockerRepo(): string;

  abstract getImageRegistrySettingScript(
    registry: string,
    type: string
  ): string;

  abstract setPackageRepository(destPath: string): string;

  abstract installGdisk(): string;
}
