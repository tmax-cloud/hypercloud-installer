/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import YAML from 'yaml';
import * as scp from '../../common/scp';
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import ScriptFactory from '../script/ScriptFactory';

import * as Common from '../../common/common';
import Node from '../Node';
import CONST from '../../constants/constant';

export default class HyperAuthInstaller extends AbstractInstaller {
  public static readonly DIR = `install-hyperauth`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/${HyperAuthInstaller.DIR}`;

  public static readonly IMAGE_HOME = `${HyperAuthInstaller.INSTALL_HOME}/image`;

  public static readonly POSTGRES_VERSION = '9.6.2-alpine';

  public static readonly HYPERAUTH_SERVER_VERSION = 'latest';

  public static readonly KAFKA_VERSION = '2.12-2.0.1';

  public static readonly ZOOKEEPER_VERSION = '3.4.6';

  public static readonly HYPERAUTH_LOG_COLLECTOR_VERSION = 'b0.0.0.14';

  // singleton
  private static instance: HyperAuthInstaller;

  private constructor() {
    super();
  }

  static get getInstance() {
    if (!HyperAuthInstaller.instance) {
      HyperAuthInstaller.instance = new HyperAuthInstaller();
    }
    return this.instance;
  }

  /**
   * abstract 메서드 구현부
   */
  public async install(param: { callback: any; setProgress: Function }) {
    const { callback, setProgress } = param;

    setProgress(10);
    await this.preWorkInstall({
      callback
    });
    setProgress(60);
    await this._installMainMaster(callback);
    setProgress(100);
  }

  public async remove() {
    await this._removeMainMaster();
  }

  protected async preWorkInstall(param?: any) {
    console.debug('@@@@@@ Start pre-installation... @@@@@@');
    const { callback } = param;
    // await this._copyFile(callback);
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      // internal network 경우 해주어야 할 작업들
      /**
       * 1. 해당 이미지 파일 다운(client 로컬), 전송 (main 마스터 노드)
       * 2. git guide 다운(client 로컬), 전송(각 노드)
       */
      // await this.downloadImageFile();
      // await this.sendImageFile();

      await this.downloadGitFile();
      await this.sendGitFile();
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      // external network 경우 해주어야 할 작업들
      /**
       * 1. public 패키지 레포 등록, 설치 (각 노드) (필요 시)
       * 2. git guide clone (마스터 노드)
       */
      await this._installOpenSSL(callback);
      await this.cloneGitFile(callback);
    }

    if (this.env.registry) {
      // 내부 image registry 구축 경우 해주어야 할 작업들
      /**
       * 1. 레지스트리 관련 작업
       */
      // await this.registryWork({
      //   callback
      // });
    }
    console.debug('###### Finish pre-installation... ######');
  }

  // protected async downloadImageFile() {
  //   // TODO: download image file
  //   console.debug(
  //     '@@@@@@ Start downloading the image file to client local... @@@@@@'
  //   );
  //   console.debug(
  //     '###### Finish downloading the image file to client local... ######'
  //   );
  // }

  // protected async sendImageFile() {
  //   console.debug(
  //     '@@@@@@ Start sending the image file to main master node... @@@@@@'
  //   );
  //   const { mainMaster } = this.env.getNodesSortedByRole();
  //   const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${HyperAuthInstaller.DIR}/`;
  //   await scp.sendFile(
  //     mainMaster,
  //     srcPath,
  //     `${HyperAuthInstaller.IMAGE_HOME}/`
  //   );
  //   console.debug(
  //     '###### Finish sending the image file to main master node... ######'
  //   );
  // }

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
    mainMaster.cmd = script.cloneGitFile(
      CONST.HYPERAUTH_REPO,
      CONST.GIT_BRANCH
    );
    await mainMaster.exeCmd(callback);
    console.debug('###### Finish clone the GIT file at each node... ######');
  }

  // protected async registryWork(param: { callback: any }) {
  //   console.debug(
  //     '@@@@@@ Start pushing the image at main master node... @@@@@@'
  //   );
  //   const { callback } = param;
  //   const { mainMaster } = this.env.getNodesSortedByRole();
  //   mainMaster.cmd = this.getImagePushScript();
  //   await mainMaster.exeCmd(callback);
  //   console.debug(
  //     '###### Finish pushing the image at main master node... ######'
  //   );
  // }

  // protected getImagePushScript(): string {
  //   let gitPullCommand = `
  //   mkdir -p ~/${HyperAuthInstaller.IMAGE_HOME};
  //   export HYPERAUTH_HOME=~/${HyperAuthInstaller.IMAGE_HOME};
  //   export POSTGRES_VERSION=${HyperAuthInstaller.POSTGRES_VERSION};
  //   export HYPERAUTH_SERVER_VERSION=${HyperAuthInstaller.HYPERAUTH_SERVER_VERSION};
  //   export REGISTRY=${this.env.registry};
  //   cd $HYPERAUTH_HOME;
  //   `;
  //   if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
  //     gitPullCommand += `
  //     sudo docker load < postgres_\${POSTGRES_VERSION}.tar;
  //     sudo docker load < hyperauth_b\${HYPERAUTH_SERVER_VERSION}.tar;
  //     # sudo docker save tmaxcloudck/hyperauth:b\${HYPERAUTH_SERVER_VERSION} > hyperauth_b\${HYPERAUTH_SERVER_VERSION}.tar;
  //     # sudo docker save postgres:\${POSTGRES_VERSION} > postgres_\${POSTGRES_VERSION}.tar;
  //     `;
  //   } else {
  //     gitPullCommand += `
  //     sudo docker pull postgres:\${POSTGRES_VERSION};
  //     sudo docker pull tmaxcloudck/hyperauth:b\${HYPERAUTH_SERVER_VERSION};
  //     `;
  //   }
  //   return `
  //     ${gitPullCommand}
  //     sudo docker tag postgres:\${POSTGRES_VERSION} \${REGISTRY}/postgres:\${POSTGRES_VERSION}
  //     sudo docker tag tmaxcloudck/hyperauth:b\${HYPERAUTH_SERVER_VERSION}; \${REGISTRY}/tmaxcloudck/hyperauth:b\${HYPERAUTH_SERVER_VERSION};

  //     sudo docker push \${REGISTRY}/postgres:\${POSTGRES_VERSION}
  //     sudo docker push \${REGISTRY}/tmaxcloudck/hyperauth:b\${HYPERAUTH_SERVER_VERSION};
  //     #rm -rf $HYPERAUTH_HOME;
  //     `;
  // }

  public async realmImport(param: {
    state: any;
    callback: any;
    setProgress: Function;
  }) {
    const { state, callback } = param;
    const { mainMaster } = this.env.getNodesSortedByRole();

    // FIXME: targetEmail, targetPassword 값 변경 될 가능성 있음
    const targetEmail = 'hc-admin@tmax.co.kr';
    const targetPassword = 'Tmaxadmin1!';
    const newEmail = state.email;
    const newPassword = state.password;

    mainMaster.cmd = `
    export HYPERAUTH_SERVICE_IP=\`kubectl describe service hyperauth -n hyperauth | grep 'LoadBalancer Ingress' | cut -d ' ' -f7\`;
    export HYPERCLOUD_CONSOLE_IP=\`kubectl describe service console -n console-system | grep 'LoadBalancer Ingress' | cut -d ' ' -f7\`;
    \\cp ~/${HyperAuthInstaller.INSTALL_HOME}/manifest/tmaxRealmImport.sh ~/${HyperAuthInstaller.INSTALL_HOME}/manifest/tmaxRealmImportCopy.sh;
    cd ~/${HyperAuthInstaller.INSTALL_HOME}/manifest;
    sed -i 's|\\r$||g' tmaxRealmImportCopy.sh;
    sed -i 's/${targetEmail}/${newEmail}/g' tmaxRealmImportCopy.sh;
    sed -i 's/${targetPassword}/${newPassword}/g' tmaxRealmImportCopy.sh;
    chmod 755 tmaxRealmImportCopy.sh;
    ./tmaxRealmImportCopy.sh \${HYPERAUTH_SERVICE_IP} \${HYPERCLOUD_CONSOLE_IP};
    `;
    await mainMaster.exeCmd(callback);
  }

  public async deleteUser(param: { userName: string; callback?: any }) {
    const { userName, callback } = param;
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = `
    export HYPERAUTH_SERVICE_IP=\`kubectl describe service hyperauth -n hyperauth | grep 'LoadBalancer Ingress' | cut -d ' ' -f7\`;
    token=$(curl -X POST 'http://'$HYPERAUTH_SERVICE_IP':8080/auth/realms/master/protocol/openid-connect/token' \\
    -H "Content-Type: application/x-www-form-urlencoded" \\
    -d "username=admin" \\
    -d 'password=admin' \\
    -d 'grant_type=password' \\
    -d 'client_id=admin-cli' | jq -r '.access_token')

    echo accessToken : $token

    curl -X DELETE \\
    'http://'$HYPERAUTH_SERVICE_IP':8080/auth/realms/tmax/user/${userName}?token=$token'
    `;
    await mainMaster.exeCmd(callback);
  }

  private async _installMainMaster(callback: any) {
    console.debug('@@@@@@ Start installing main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();

    // Step 0. hyperauth.config 설정
    mainMaster.cmd = this._step0();
    await mainMaster.exeCmd(callback);

    // FIXME:
    // 개발 환경에서는
    // 테스트 시, POD의 메모리를 조정하여 테스트
    // kafka, log_collector 설치 안함
    if (process.env.RESOURCE === 'low') {
      const script = `
      cd ~/${HyperAuthInstaller.INSTALL_HOME}/manifest;
      sed -i 's/cpu: "1"/#cpu: "0.3"/g' 1.initialization.yaml;
      sed -i 's/memory: "2Gi"/#memory: "500Mi"/g' 1.initialization.yaml;

      sed -i 's/cpu: "1"/#cpu: "0.3"/g' 2.hyperauth_deployment.yaml;
      sed -i 's/memory: "1Gi"/#memory: "300Mi"/g' 2.hyperauth_deployment.yaml;

      sed -i 's/cpu: "1"/#cpu: "0.3"/g' 4.kafka_all.yaml;
      sed -i 's/memory: "1Gi"/#memory: "300Mi"/g' 4.kafka_all.yaml;

      sed -i 's/kubectl apply -f 4.kafka_all.yaml/#kubectl apply -f 4.kafka_all.yaml/g' install.sh;
      sed -i 's/kubectl apply -f 5.hyperauth_log_collector.yaml/#kubectl apply -f 5.hyperauth_log_collector.yaml/g' install.sh;
      `;
      mainMaster.cmd = script;
      await mainMaster.exeCmd(callback);
    }

    // Step 1. installer 실행
    mainMaster.cmd = this._step1();
    await mainMaster.exeCmd(callback);

    console.debug('###### Finish installing main Master... ######');
  }

  private _step0() {
    const { mainMaster } = this.env.getNodesSortedByRole();

    // FIXME: default storageclass 설정하는 부분, 다른 쪽으로 빼야 할 듯
    let script = `
      kubectl patch storageclass csi-cephfs-sc -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'

      cd ~/${HyperAuthInstaller.INSTALL_HOME}/manifest;
      sudo sed -i 's|\\r$||g' hyperauth.config;
      . hyperauth.config;
      sudo sed -i "s|$POSTGRES_VERSION|${HyperAuthInstaller.POSTGRES_VERSION}|g" ./hyperauth.config;
      sudo sed -i "s|$HYPERAUTH_SERVER_VERSION|${HyperAuthInstaller.HYPERAUTH_SERVER_VERSION}|g" ./hyperauth.config;
      sudo sed -i "s|$KAFKA_VERSION|${HyperAuthInstaller.KAFKA_VERSION}|g" ./hyperauth.config;
      sudo sed -i "s|$ZOOKEEPER_VERSION|${HyperAuthInstaller.ZOOKEEPER_VERSION}|g" ./hyperauth.config;
      sudo sed -i "s|$HYPERAUTH_LOG_COLLECTOR_VERSION|${HyperAuthInstaller.HYPERAUTH_LOG_COLLECTOR_VERSION}|g" ./hyperauth.config;
      sudo sed -i "s|$MAIN_MASTER_IP|${mainMaster.ip}|g" ./hyperauth.config;
      sudo sed -i "s|$MASTER_NODE_ROOT_PASSWORD|${mainMaster.password}|g" ./hyperauth.config;
      sudo sed -i "s|$MASTER_NODE_ROOT_USER|${mainMaster.user}|g" ./hyperauth.config;
    `;

    if (this.env.registry) {
      script += `sudo sed -i "s|$REGISTRY|${this.env.registry}|g" ./hyperauth.config;`;
    }

    return script;
  }

  private _step1() {
    return `
    cd ~/${HyperAuthInstaller.INSTALL_HOME}/manifest;
    sudo chmod +x install.sh;
    ./install.sh
    `;
  }

  private async _installOpenSSL(callback: any) {
    console.debug('@@@@@@ Start openssl install... @@@@@@');
    await Promise.all(
      this.env.nodeList.map((node: Node) => {
        const script = ScriptFactory.createScript(node.os.type);
        node.cmd = script.installOpenSSL();

        return node.exeCmd(callback);
      })
    );
    console.debug('###### Finish openssl install... ######');
  }

  private async _removeMainMaster() {
    console.debug('@@@@@@ Start remove main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getRemoveScript();
    await mainMaster.exeCmd();

    // FIXME: kube-apiserver.yaml 수정하면, api server 고장남
    // await this.rollbackApiServerYaml([...masterArr, mainMaster]);
    console.debug('###### Finish remove main Master... ######');
  }

  private _getRemoveScript(): string {
    return `
    cd ~/${HyperAuthInstaller.INSTALL_HOME}/manifest;
    sudo chmod +x uninstall.sh;
    ./uninstall.sh
    rm -rf ~/${HyperAuthInstaller.INSTALL_HOME};
    `;
  }
}
