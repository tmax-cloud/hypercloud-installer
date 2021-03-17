/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import * as scp from '../../common/scp';
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import ScriptFactory from '../script/ScriptFactory';
import CONST from '../../constants/constant';

export default class CatalogControllerInstaller extends AbstractInstaller {
  public static readonly DIR = `install-catalog`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/${CatalogControllerInstaller.DIR}`;

  public static readonly IMAGE_HOME = `${CatalogControllerInstaller.INSTALL_HOME}/image`;

  public static readonly VERSION = `0.3.0`;

  // singleton
  private static instance: CatalogControllerInstaller;

  private constructor() {
    super();
  }

  static get getInstance() {
    if (!CatalogControllerInstaller.instance) {
      CatalogControllerInstaller.instance = new CatalogControllerInstaller();
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
      await this.downloadImageFile();
      await this.sendImageFile();

      await this.downloadGitFile();
      await this.sendGitFile();
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      // external network 경우 해주어야 할 작업들
      /**
       * 1. public 패키지 레포 등록, 설치 (각 노드) (필요 시)
       * 2. git guide clone (마스터 노드)
       */
      await this.cloneGitFile(callback);
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
    const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${CatalogControllerInstaller.DIR}/`;
    await scp.sendFile(
      mainMaster,
      srcPath,
      `${CatalogControllerInstaller.IMAGE_HOME}/`
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
    mainMaster.cmd = script.cloneGitFile(CONST.CATALOG_REPO, CONST.GIT_BRANCH);
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
  mkdir -p ~/${CatalogControllerInstaller.IMAGE_HOME};
  export CATALOG_HOME=~/${CatalogControllerInstaller.IMAGE_HOME};
  export CATALOG_VERSION=v${CatalogControllerInstaller.VERSION};
  export REGISTRY=${this.env.registry};
  cd $CATALOG_HOME;
  `;
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      gitPullCommand += `
    docker load < service-catalog_v\${CATALOG_VERSION}.tar
    `;
    } else {
      gitPullCommand += `
    docker pull quay.io/kubernetes-service-catalog/service-catalog:v\${CATALOG_VERSION}

    #docker save quay.io/kubernetes-service-catalog/service-catalog:v\${CATALOG_VERSION} > service-catalog_v\${CATALOG_VERSION}.tar
    `;
    }
    return `
    ${gitPullCommand}
    docker tag quay.io/kubernetes-service-catalog/service-catalog:v\${CATALOG_VERSION} \${REGISTRY}/quay.io/kubernetes-service-catalog/service-catalog:v\${CATALOG_VERSION}

    docker push \${REGISTRY}/quay.io/kubernetes-service-catalog/service-catalog:v\${CATALOG_VERSION}
    #rm -rf $CATALOG_HOME;
    `;
  }

  private async _installMainMaster(callback: any) {
    console.debug(
      '@@@@@@ Start installing catalog controller main Master... @@@@@@'
    );
    const { mainMaster } = this.env.getNodesSortedByRole();

    // // Step 1. 설치에 필요한 crd 생성
    // mainMaster.cmd = this._step1();
    // await mainMaster.exeCmd(callback);

    // // Step 2. catalog controller namespace 및 servcice account 생성
    // mainMaster.cmd = this._step2();
    // await mainMaster.exeCmd(callback);

    // // Step 3. catalog manager 생성
    // mainMaster.cmd = this._step3();
    // await mainMaster.exeCmd(callback);

    // // Step 4. webhook 인증 키 생성
    // mainMaster.cmd = this._step4();
    // await mainMaster.exeCmd(callback);

    // // Step 5. catalog-webhook 생성
    // mainMaster.cmd = this._step5();
    // await mainMaster.exeCmd(callback);

    // Step0. catalog.config 설정
    mainMaster.cmd = this._step0();
    await mainMaster.exeCmd(callback);

    // Step1. install-catalog
    mainMaster.cmd = this._step1();
    await mainMaster.exeCmd(callback);

    console.debug(
      '###### Finish installing catalog controller main Master... ######'
    );
  }

  private _step0() {
    let script = `
    cd ~/${CatalogControllerInstaller.INSTALL_HOME}/manifest;
    sudo sed -i 's|\\r$||g' catalog.config;
    . catalog.config;

    sudo sed -i "s|$catalogVersion|${CatalogControllerInstaller.VERSION}|g" ./catalog.config;
  `;

    if (this.env.registry) {
      script += `sudo sed -i "s|$imageRegistry|${this.env.registry}|g" ./catalog.config;`;
    } else {
      script += `sudo sed -i "s|$imageRegistry|quay.io|g" ./catalog.config;`;
    }

    return script;
  }

  private _step1() {
    return `
    cd ~/${CatalogControllerInstaller.INSTALL_HOME}/manifest;
    sudo ./install-catalog.sh install
    `;
    // return `
    // cd ~/${CatalogControllerInstaller.INSTALL_HOME}/manifest;
    // kubectl apply -f crds/
    // `;
  }

  // private _step2() {
  //   return `
  //   cd ~/${CatalogControllerInstaller.INSTALL_HOME}/manifest;
  //   kubectl create namespace catalog;
  //   kubectl apply -f serviceaccounts.yaml;
  //   kubectl apply -f rbac.yaml;
  //   `;
  // }

  // private _step3() {
  //   let script = ``;
  //   if (this.env.registry) {
  //     script += `
  //     sed -i 's| quay.io| '${this.env.registry}'/quay.io|g' *.yaml;
  //     `;
  //   }

  //   return `
  //   cd ~/${CatalogControllerInstaller.INSTALL_HOME}/manifest;
  //   ${script}
  //   kubectl apply -f controller-manager-deployment.yaml;
  //   kubectl apply -f controller-manager-service.yaml;
  //   `;
  // }

  // private _step4() {
  //   return `
  //   cd ~/${CatalogControllerInstaller.INSTALL_HOME}/manifest/ca;
  //   openssl genrsa -out rootca.key 2048;
  //   openssl req -x509 -new -nodes -key rootca.key -sha256 -days 3650 -subj /C=KO/ST=None/L=None/O=None/CN=catalog-catalog-webhook -out rootca.crt;
  //   openssl req -new -newkey rsa:2048 -sha256 -nodes -keyout server.key -subj /C=KO/ST=None/L=None/O=None/CN=catalog-catalog-webhook -out server.csr;
  //   openssl x509 -req -in server.csr -CA rootca.crt -CAkey rootca.key -CAcreateserial -out server.crt -days 3650 -sha256 -extfile ./v3.ext;
  //   openssl base64 -in rootca.crt -out key0;
  //   openssl base64 -in server.crt -out cert;
  //   openssl base64 -in server.key -out key;
  //   `;
  // }

  // private _step5() {
  //   return `
  //   cd ~/${CatalogControllerInstaller.INSTALL_HOME}/manifest/ca;
  //   export key0=\`cat key0 | tr -d '\\n'\`;
  //   export cert=\`cat cert | tr -d '\\n'\`;
  //   export key=\`cat key | tr -d '\\n'\`;
  //   cd ~/${CatalogControllerInstaller.INSTALL_HOME}/manifest;
  //   sed -i "s/{{ b64enc \\$ca.Cert }}/$key0/g" webhook-register.yaml;
  //   sed -i "s/{{ b64enc \\$cert.Cert }}/$cert/g" webhook-register.yaml;
  //   sed -i "s/{{ b64enc \\$cert.Key }}/$key/g" webhook-register.yaml;
  //   kubectl apply -f webhook-register.yaml;
  //   kubectl apply -f webhook-deployment.yaml;
  //   kubectl apply -f webhook-service.yaml;
  //   `;
  // }

  private async _removeMainMaster() {
    console.debug('@@@@@@ Start remove console main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getRemoveScript();
    await mainMaster.exeCmd();
    console.debug('###### Finish remove console main Master... ######');
  }

  private _getRemoveScript(): string {
    // 설치의 역순
    // return `
    // cd ~/${CatalogControllerInstaller.INSTALL_HOME}/manifest;
    // kubectl delete -f webhook-service.yaml;
    // kubectl delete -f webhook-deployment.yaml;
    // kubectl delete -f webhook-register.yaml;

    // kubectl delete -f controller-manager-service.yaml;
    // kubectl delete -f controller-manager-deployment.yaml;

    // kubectl delete -f rbac.yaml;
    // kubectl delete -f serviceaccounts.yaml;
    // kubectl delete namespace catalog;

    // kubectl delete -f crds/
    // rm -rf ~/${CatalogControllerInstaller.INSTALL_HOME};
    // `;
    return `
    cd ~/${CatalogControllerInstaller.INSTALL_HOME}/manifest;
    sudo ./install-catalog.sh uninstall
    rm -rf ~/${CatalogControllerInstaller.INSTALL_HOME};
    `;
  }

  // private async _downloadYaml() {
  //   console.debug('@@@@@@ Start download yaml file from external... @@@@@@');
  //   const { mainMaster } = this.env.getNodesSortedByRole();
  //   mainMaster.cmd = `
  //   mkdir -p ~/${CatalogControllerInstaller.INSTALL_HOME};
  //   cd ~/${CatalogControllerInstaller.INSTALL_HOME};
  //   curl https://raw.githubusercontent.com/tmax-cloud/hypercloud-console4.1/hc-dev/install-yaml/1.initialization.yaml > 1.initialization.yaml;
  //   curl https://raw.githubusercontent.com/tmax-cloud/hypercloud-console4.1/hc-dev/install-yaml/2.svc-lb.yaml > 2.svc-lb.yaml;
  //   curl https://raw.githubusercontent.com/tmax-cloud/hypercloud-console4.1/hc-dev/install-yaml/3.deployment-pod.yaml > 3.deployment-pod.yaml;
  //   `;
  //   await mainMaster.exeCmd();
  //   console.debug('###### Finish download yaml file from external... ######');
  // }

  // private async _copyFile(callback: any) {
  //   console.debug('@@@@@@ Start copy yaml file... @@@@@@');
  //   const { mainMaster } = this.env.getNodesSortedByRole();
  //   mainMaster.cmd = `
  //   \\cp -r ~/${CatalogControllerInstaller.INSTALL_HOME}/yaml_install ~/${CatalogControllerInstaller.INSTALL_HOME}/manifest;
  //   `;
  //   await mainMaster.exeCmd(callback);
  //   console.debug('###### Finish copy yaml file... ######');
  // }
}
