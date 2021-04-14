/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import * as scp from '../../common/scp';
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import ScriptFactory from '../script/ScriptFactory';
import CONST from '../../constants/constant';

export default class HyperCloudConsoleInstaller extends AbstractInstaller {
  public static readonly IMAGE_DIR = `install-console`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/${HyperCloudConsoleInstaller.IMAGE_DIR}`;

  public static readonly IMAGE_HOME = `${HyperCloudConsoleInstaller.INSTALL_HOME}/image`;

  public static readonly CONSOLE_VERSION = `4.1.4.25`;

  public static readonly CONSOLE_NAMESPACE = `console-system`;

  public static readonly HCDC_MODE = false;

  // singleton
  private static instance: HyperCloudConsoleInstaller;

  private constructor() {
    super();
  }

  static get getInstance() {
    if (!HyperCloudConsoleInstaller.instance) {
      HyperCloudConsoleInstaller.instance = new HyperCloudConsoleInstaller();
    }
    return this.instance;
  }

  /**
   * abstract 메서드 구현부
   */
  public async install(param: { callback: any; setProgress: Function }) {
    const { callback } = param;

    await this.preWorkInstall({
      callback
    });

    await this._installMainMaster(callback);
  }

  public async remove() {
    await this._removeMainMaster();
  }

  // protected abstract 구현
  protected async preWorkInstall(param?: any) {
    console.debug('@@@@@@ Start pre-installation... @@@@@@');
    const { callback } = param;
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      // internal network 경우 해주어야 할 작업들
      /**
       * 1. 해당 이미지 파일 다운(client 로컬), 전송 (main 마스터 노드)
       * 2. git guide 다운(client 로컬), 전송(각 노드)
       */
      await this.downloadImageFile();
      await this.sendImageFile();

      await this.downloadGitFile();
      await this.sendGitFile();
      // TODO: downloadYamlAtLocal();
      // TODO: sendYaml();
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      // external network 경우 해주어야 할 작업들
      /**
       * 1. public 패키지 레포 등록, 설치 (각 노드) (필요 시)
       * 2. git guide clone (마스터 노드)
       */
      await this.cloneGitFile(callback);
      // await this._downloadYaml();
    }

    if (this.env.registry) {
      // 내부 image registry 구축 경우 해주어야 할 작업들
      /**
       * 1. 레지스트리 관련 작업
       */
      await this.registryWork({
        callback
      });
    }
    console.debug('###### Finish pre-installation... ######');
  }

  protected async downloadImageFile() {
    // TODO: download image file
    console.debug(
      '@@@@@@ Start downloading the image file to client local... @@@@@@'
    );
    console.debug(
      '###### Finish downloading the image file to client local... ######'
    );
  }

  protected async sendImageFile() {
    console.debug(
      '@@@@@@ Start sending the image file to main master node... @@@@@@'
    );
    const { mainMaster } = this.env.getNodesSortedByRole();
    const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${HyperCloudConsoleInstaller.IMAGE_DIR}/`;
    await scp.sendFile(
      mainMaster,
      srcPath,
      `${HyperCloudConsoleInstaller.IMAGE_HOME}/`
    );
    console.debug(
      '###### Finish sending the image file to main master node... ######'
    );
  }

  protected downloadGitFile(param?: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  protected sendGitFile(param?: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  protected async cloneGitFile(callback: any) {
    console.debug('@@@@@@ Start clone the GIT file at each node... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    const script = ScriptFactory.createScript(mainMaster.os.type);
    mainMaster.cmd = script.cloneGitFile(CONST.CONSOLE_REPO, CONST.GIT_BRANCH);
    await mainMaster.exeCmd(callback);
    console.debug('###### Finish clone the GIT file at each node... ######');
  }

  protected async registryWork(param: { callback: any }) {
    console.debug(
      '@@@@@@ Start pushing the image at main master node... @@@@@@'
    );
    const { callback } = param;
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this.getImagePushScript();
    await mainMaster.exeCmd(callback);
    console.debug(
      '###### Finish pushing the image at main master node... ######'
    );
  }

  protected getImagePushScript(): string {
    let gitPullCommand = `
  mkdir -p ~/${HyperCloudConsoleInstaller.IMAGE_HOME};
  export CONSOLE_HOME=~/${HyperCloudConsoleInstaller.IMAGE_HOME};
  export CONSOLE_VERSION=v${HyperCloudConsoleInstaller.CONSOLE_VERSION};
  export REGISTRY=${this.env.registry};
  cd $CONSOLE_HOME;
  `;
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      gitPullCommand += `
    sudo docker load < console_\${CONSOLE_VERSION}.tar;
    `;
    } else {
      gitPullCommand += `
    sudo docker pull  tmaxcloudck/hypercloud-console:\${CONSOLE_VERSION};
    `;
    }
    return `
    ${gitPullCommand}
    sudo docker tag tmaxcloudck/hypercloud-console:\${CONSOLE_VERSION} \${REGISTRY}/tmaxcloudck/hypercloud-console:\${CONSOLE_VERSION};

    sudo docker push \${REGISTRY}/tmaxcloudck/hypercloud-console:\${CONSOLE_VERSION}
    #rm -rf $CONSOLE_HOME;
    `;
  }

  private async _installMainMaster(callback: any) {
    console.debug('@@@@@@ Start installing console main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();

    // Step 1. Namespace, ResourceQuota, ServiceAccount, ClusterRole, ClusterRoleBinding 생성
    mainMaster.cmd = this._step1();
    await mainMaster.exeCmd(callback);

    // Step 2. Secret (TLS) 생성
    mainMaster.cmd = this._step2();
    await mainMaster.exeCmd(callback);

    // Step 3. Service (Load Balancer) 생성
    mainMaster.cmd = this._step3();
    await mainMaster.exeCmd(callback);

    // Step 4. Deployment (with Pod Template) 생성
    mainMaster.cmd = this._step4();
    await mainMaster.exeCmd(callback);

    // Step 5. 동작 확인
    mainMaster.cmd = this._step5();
    await mainMaster.exeCmd(callback);

    console.debug('###### Finish installing console main Master... ######');
  }

  private _step1() {
    return `
    cd ~/${HyperCloudConsoleInstaller.INSTALL_HOME}/manifest;
    sed -i 's/@@NAME_NS@@/${HyperCloudConsoleInstaller.CONSOLE_NAMESPACE}/g' 1.initialization.yaml;
    kubectl create -f 1.initialization.yaml;
    `;
  }

  private _step2() {
    // FIXME: 현재 발급받은 인증서가 없는 경우만 고려됨
    return `
    cd ~/${HyperCloudConsoleInstaller.INSTALL_HOME}/manifest;
    mkdir -p tls;
    cd tls;
    openssl genrsa -out tls.key 2048;
    openssl req -new -key tls.key -subj "/C=KR/ST=Seoul/L=Seoul/O=tmax" -out tls.csr;
    openssl x509 -req -days 3650 -in tls.csr -signkey tls.key -out tls.crt;
    cd ~/${HyperCloudConsoleInstaller.INSTALL_HOME}/manifest;
    kubectl create secret tls console-https-secret --cert=./tls/tls.crt --key=./tls/tls.key -n ${HyperCloudConsoleInstaller.CONSOLE_NAMESPACE};
    `;
  }

  private _step3() {
    return `
    cd ~/${HyperCloudConsoleInstaller.INSTALL_HOME}/manifest;
    sed -i 's/@@NAME_NS@@/${HyperCloudConsoleInstaller.CONSOLE_NAMESPACE}/g' 2.svc-lb.yaml;
    kubectl create -f 2.svc-lb.yaml;
    `;
  }

  private _step4() {
    let script = `
    cd ~/${HyperCloudConsoleInstaller.INSTALL_HOME}/manifest;
    sed -i 's/@@NAME_NS@@/${HyperCloudConsoleInstaller.CONSOLE_NAMESPACE}/g' 3.deployment.yaml;

    export HYPERCLOUD_OPERATOR_CLUSTER_IP=\`kubectl get svc -n hypercloud4-system -o jsonpath='{.items[?(@.metadata.name=="hypercloud4-operator-service")].spec.clusterIP}'\`;
    export HYPERCLOUD_OPERATOR_CLUSTER_IP=\${HYPERCLOUD_OPERATOR_CLUSTER_IP:-0.0.0.0}
    export HYPERCLOUD_OPERATOR_PORT=\`kubectl get svc -n hypercloud4-system -o jsonpath='{.items[?(@.metadata.name=="hypercloud4-operator-service")].spec.ports[0].port}'\`;
    export HYPERCLOUD_OPERATOR_PORT=\${HYPERCLOUD_OPERATOR_PORT:-28677}
    sed -i 's/@@HC4@@/'\${HYPERCLOUD_OPERATOR_CLUSTER_IP}':'\${HYPERCLOUD_OPERATOR_PORT}'/g' 3.deployment.yaml;

    export PROMETHEUS_CLUSTER_IP=\`kubectl get svc -n monitoring -o jsonpath='{.items[?(@.metadata.name=="prometheus-k8s")].spec.clusterIP}'\`
    export PROMETHEUS_CLUSTER_IP=\${PROMETHEUS_CLUSTER_IP:-0.0.0.0}
    export PROMETHEUS_PORT=\`kubectl get svc -n monitoring -o jsonpath='{.items[?(@.metadata.name=="prometheus-k8s")].spec.ports[0].port}'\`
    export PROMETHEUS_PORT=\${PROMETHEUS_PORT:-9090}
    sed -i 's/@@PROM@@/'\${PROMETHEUS_CLUSTER_IP}':'\${PROMETHEUS_PORT}'/g' 3.deployment.yaml;

    export GRAFANA_CLUSTER_IP=\`kubectl get svc -n monitoring -o jsonpath='{.items[?(@.metadata.name=="grafana")].spec.clusterIP}'\`
    export GRAFANA_CLUSTER_IP=\${GRAFANA_CLUSTER_IP:-0.0.0.0}
    export GRAFANA_PORT=\`kubectl get svc -n monitoring -o jsonpath='{.items[?(@.metadata.name=="grafana")].spec.ports[0].port}'\`
    export GRAFANA_PORT=\${GRAFANA_PORT:-3000}
    sed -i 's/@@GRAFANA@@/'\${GRAFANA_CLUSTER_IP}':'\${GRAFANA_PORT}'/g' 3.deployment.yaml;

    sed -i 's/@@KIALI@@/0.0.0.0:20001/g' 3.deployment.yaml;
    sed -i 's/@@JAEGER@@/0.0.0.0:80/g' 3.deployment.yaml;
    sed -i 's/@@APPROVAL@@/0.0.0.0:80/g' 3.deployment.yaml;
    sed -i 's/@@KUBEFLOW@@/0.0.0.0:80/g' 3.deployment.yaml;

    export WEBHOOK_CLUSTER_IP=\`kubectl get svc -n hypercloud4-system -o jsonpath='{.items[?(@.metadata.name=="hypercloud4-webhook-svc")].spec.clusterIP}'\`
    export WEBHOOK_CLUSTER_IP=\${WEBHOOK_CLUSTER_IP:-0.0.0.0}
    export WEBHOOK_PORT=\`kubectl get svc -n hypercloud4-system -o jsonpath='{.items[?(@.metadata.name=="hypercloud4-webhook-svc")].spec.ports[0].port}'\`
    export WEBHOOK_PORT=\${WEBHOOK_PORT:-80}
    sed -i 's/@@WEBHOOK@@/'\${WEBHOOK_CLUSTER_IP}':'\${WEBHOOK_PORT}'/g' 3.deployment.yaml;

    sed -i 's/@@VNC@@/0.0.0.0:80/g' 3.deployment.yaml;

    export HYPERAUTH_CLUSTER_IP=\`kubectl get svc -n hyperauth -o jsonpath='{.items[?(@.metadata.name=="hyperauth")].spec.clusterIP}'\`
    export HYPERAUTH_CLUSTER_IP=\${HYPERAUTH_CLUSTER_IP:-0.0.0.0}
    export HYPERAUTH_PORT=\`kubectl get svc -n hyperauth -o jsonpath='{.items[?(@.metadata.name=="hyperauth")].spec.ports[0].port}'\`
    export HYPERAUTH_PORT=\${HYPERAUTH_PORT:-80}
    sed -i 's/@@HYPERAUTH@@/'\${HYPERAUTH_CLUSTER_IP}':'\${HYPERAUTH_PORT}'/g' 3.deployment.yaml;

    sed -i 's/@@REALM@@/tmax/g' 3.deployment.yaml;

    export HYPERAUTH_EXTERNAL_IP=\`kubectl get svc -n hyperauth -o jsonpath='{.items[?(@.metadata.name=="hyperauth")].status.loadBalancer.ingress[0].ip}'\`
    export HYPERAUTH_EXTERNAL_IP=\${HYPERAUTH_EXTERNAL_IP:-0.0.0.0}
    sed -i 's/@@KEYCLOAK@@/'\${HYPERAUTH_EXTERNAL_IP}'/g' 3.deployment.yaml;

    sed -i 's/@@CLIENTID@@/hypercloud4/g' 3.deployment.yaml
    sed -i 's/@@HIDDEN@@/false/g' 3.deployment.yaml;
    `;

    if (HyperCloudConsoleInstaller.HCDC_MODE) {
      script += `
      sed -i 's/@@HDC_FLAG@@/true/g' 3.deployment.yaml;
      # sed -i 's/@@PORTAL@@/???/g' 3.deployment.yaml;
      `;
    } else {
      script += `
      sed -i 's/- --hdc-mode=@@HDC_FLAG@@//g' 3.deployment.yaml;
      sed -i 's/- --tmaxcloud-portal=@@PORTAL@@//g' 3.deployment.yaml;
      `;
    }

    script += `
    sed -i 's/@@VER@@/${HyperCloudConsoleInstaller.CONSOLE_VERSION}/g' 3.deployment.yaml;
    `;

    if (this.env.registry) {
      script += `
      sed -i 's| tmaxcloudck| ${this.env.registry}/tmaxcloudck|g' 3.deployment.yaml;
      `;
    }

    // 개발 환경에서는 테스트 시, POD의 메모리를 조정하여 테스트
    if (process.env.RESOURCE === 'low') {
      script += `
      sed -i "s/memory: '2Gi'/memory: '1Gi'/g" 3.deployment.yaml;
      sed -i "s/cpu: '1'/cpu: '0.5'/g" 3.deployment.yaml;
      `;
    }

    script += `
    kubectl create -f 3.deployment.yaml;
    `;

    return script;
  }

  private _step5() {
    return `
    `;
  }

  private async _removeMainMaster() {
    console.debug('@@@@@@ Start remove console main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getRemoveScript();
    await mainMaster.exeCmd();
    console.debug('###### Finish remove console main Master... ######');
  }

  private _getRemoveScript(): string {
    return `
    cd ~/${HyperCloudConsoleInstaller.INSTALL_HOME};
    # kubectl delete -f 3.deployment.yaml;
    # kubectl delete -f 2.svc-lb.yaml;
    # kubectl delete secret console-https-secret -n ${HyperCloudConsoleInstaller.CONSOLE_NAMESPACE};
    # kubectl delete -f 1.initialization.yaml;
    kubectl delete -f ./manifest
    rm -rf ~/${HyperCloudConsoleInstaller.INSTALL_HOME};
    `;
  }

  // XXX: install-console 로 git 프로젝트 분리 후, curl로 받아오는 내용 필요없어짐
  // private async _downloadYaml() {
  //   console.debug('@@@@@@ Start download yaml file from external... @@@@@@');
  //   const { mainMaster } = this.env.getNodesSortedByRole();
  //   mainMaster.cmd = `
  //   mkdir -p ~/${HyperCloudConsoleInstaller.INSTALL_HOME};
  //   cd ~/${HyperCloudConsoleInstaller.INSTALL_HOME};
  //   curl https://raw.githubusercontent.com/tmax-cloud/hypercloud-console4.1/hc-dev/install-yaml/1.initialization.yaml > 1.initialization.yaml;
  //   curl https://raw.githubusercontent.com/tmax-cloud/hypercloud-console4.1/hc-dev/install-yaml/2.svc-lb.yaml > 2.svc-lb.yaml;
  //   curl https://raw.githubusercontent.com/tmax-cloud/hypercloud-console4.1/hc-dev/install-yaml/3.deployment.yaml > 3.deployment.yaml;
  //   `;
  //   await mainMaster.exeCmd();
  //   console.debug('###### Finish download yaml file from external... ######');
  // }
}
